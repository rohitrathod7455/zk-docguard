import { describe, it, expect, afterAll } from 'vitest';
import { BlockchainIndexer } from '../src/indexer/worker.js';
import { prisma, disconnectPrisma } from '../src/db/client.js';

describe('Blockchain Event Indexer Worker', () => {
  const indexer = new BlockchainIndexer({ confirmationDepth: 2 });
  const testIssuerAddress = '0x999999cf1046e68e36e1aa2e0e07105eddd79c88';
  const testDocHash = '0x8888888888888888888888888888888888888888888888888888888888888888';
  const testCredId = '0x7777777777777777777777777777777777777777777777777777777777777777';

  afterAll(async () => {
    indexer.stop();
    await disconnectPrisma();
  });

  it('indexes IssuerApplied event and stores Pending issuer record', async () => {
    await indexer.handleIssuerApplied({
      issuer: testIssuerAddress,
      did: 'did:ethr:' + testIssuerAddress,
      zkKeyHash: '0x1111222233334444555566667777888811112222333344445555666677778888',
      metadataURI: 'https://indexed-university.edu/meta.json',
    });

    const issuer = await prisma.issuer.findUnique({
      where: { address: testIssuerAddress.toLowerCase() },
    });
    expect(issuer).toBeDefined();
    expect(issuer?.status).toBe('Pending');
  });

  it('indexes IssuerApproved event and transitions status to Active', async () => {
    await indexer.handleIssuerApproved(testIssuerAddress);

    const issuer = await prisma.issuer.findUnique({
      where: { address: testIssuerAddress.toLowerCase() },
    });
    expect(issuer?.status).toBe('Active');
    expect(issuer?.approvedAt).toBeDefined();
  });

  it('indexes KeyRotated event and increments key epoch', async () => {
    const newKeyHash = '0x9999888877776666555544443333222299998888777766665555444433332222';
    await indexer.handleKeyRotated({
      issuer: testIssuerAddress,
      newZkKeyHash: newKeyHash,
      keyEpoch: 1,
    });

    const issuer = await prisma.issuer.findUnique({
      where: { address: testIssuerAddress.toLowerCase() },
    });
    expect(issuer?.zkKeyHash).toBe(newKeyHash);
    expect(issuer?.keyEpoch).toBe(1);
  });

  it('indexes DocumentRegistered event and stores CredentialRecord', async () => {
    await indexer.handleDocumentRegistered({
      docHash: testDocHash,
      issuer: testIssuerAddress,
      credentialId: testCredId,
      schemaId: '0x3333333333333333333333333333333333333333333333333333333333333333',
      cid: 'QmIndexedDocumentCID12345',
      expiry: 4102444800n,
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    const cred = await prisma.credentialRecord.findUnique({
      where: { docHash: testDocHash },
    });
    expect(cred).toBeDefined();
    expect(cred?.status).toBe('Valid');
    expect(cred?.credentialId).toBe(testCredId);
  });

  it('indexes BatchRegistered event and stores IssuanceBatch', async () => {
    const batchRoot = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    await indexer.handleBatchRegistered({
      batchRoot,
      issuer: testIssuerAddress,
      count: 50,
      manifestCid: 'QmBatchManifestCID12345',
      txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    });

    const batch = await prisma.issuanceBatch.findFirst({
      where: { batchRoot },
    });
    expect(batch).toBeDefined();
    expect(batch?.count).toBe(50);
  });

  it('indexes DocumentRevoked event and marks credential status as Revoked', async () => {
    await indexer.handleDocumentRevoked(testDocHash);

    const cred = await prisma.credentialRecord.findUnique({
      where: { docHash: testDocHash },
    });
    expect(cred?.status).toBe('Revoked');
  });

  it('indexes CredentialRevoked event and creates RevocationLeaf', async () => {
    await indexer.handleCredentialRevoked({
      credentialId: testCredId,
      issuerKeyHash: '0x1111222233334444555566667777888811112222333344445555666677778888',
      issuerAddress: testIssuerAddress,
    });

    const leaf = await prisma.revocationLeaf.findFirst({
      where: { credentialId: testCredId },
    });
    expect(leaf).toBeDefined();
  });

  it('handles simulated reorg rollback gracefully', async () => {
    indexer.setLastIndexedBlock(100n);
    expect(indexer.getLastIndexedBlock()).toBe(100n);

    // Rollback to block 90
    await indexer.handleReorgRollback(90n);
    expect(indexer.getLastIndexedBlock()).toBe(90n);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CHAIN_REORG_RECOVERY' },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit?.details).toContain('90');
  });

  it('starts and stops the background indexer polling loop', () => {
    indexer.start(1000);
    indexer.stop();
  });
});
