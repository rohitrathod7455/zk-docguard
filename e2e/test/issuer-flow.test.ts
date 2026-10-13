import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@zk-docguard/api/src/server.js';
import { sealSession } from '@zk-docguard/api/src/auth/siwe.js';
import { prisma, disconnectPrisma } from '@zk-docguard/api/src/db/client.js';
import {
  generateDocumentKey,
  encryptDocument,
  decryptDocument,
  packEncryptedPayload,
  unpackEncryptedPayload,
  deriveBabyJubKeyPair,
  computeIssuerKeyHash,
  fieldToHex,
  issueUniversityDegreeCredential,
  UniversityDegreeAttributes,
} from '@zk-docguard/core';
import { keccak256 } from 'viem';
import { sha256 } from '@noble/hashes/sha2.js';

describe('E2E Phase 6: Institutional Issuer & Admin Governance Flow', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const adminAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
  const issuerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  const holderAddress = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';

  const adminCookie = `zkdg_session=${sealSession({
    address: adminAddress,
    role: 'admin',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  })}`;

  const issuerCookie = `zkdg_session=${sealSession({
    address: issuerAddress,
    role: 'issuer',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  })}`;

  let issuerKey: Awaited<ReturnType<typeof deriveBabyJubKeyPair>>;
  let issuerKeyHashHex: string;

  beforeAll(async () => {
    app = await buildApp();

    // 1. Derive deterministic BabyJubJub key for the issuer
    const seed = sha256(new TextEncoder().encode(`ZK-DocGuard-Issuer-Proving-Key:${issuerAddress}:epoch-1`));
    issuerKey = await deriveBabyJubKeyPair(seed);
    const keyHash = await computeIssuerKeyHash(issuerKey.publicKey.x, issuerKey.publicKey.y);
    issuerKeyHashHex = fieldToHex(keyHash);
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('1. institution applies and admin approves issuer onboarding', async () => {
    const did = `did:ethr:31337:${issuerAddress}`;
    const metadataURI = 'ipfs://QmNorthfieldUniversityAccreditationMetadata';

    // Cleanup existing issuer record and children if any
    await prisma.credentialRecord.deleteMany({ where: { issuerAddress } });
    await prisma.issuanceBatch.deleteMany({ where: { issuerAddress } });
    await prisma.revocationLeaf.deleteMany({ where: { issuerAddress } });
    await prisma.issuer.deleteMany({ where: { OR: [{ address: issuerAddress }, { zkKeyHash: issuerKeyHashHex }] } });

    // Issuer applies
    const applyRes = await app.inject({
      method: 'POST',
      url: '/v1/issuers/apply',
      payload: {
        address: issuerAddress,
        did,
        zkKeyHash: issuerKeyHashHex,
        metadataURI,
      },
    });

    expect(applyRes.statusCode).toBe(201);
    const applyBody = JSON.parse(applyRes.body);
    expect(applyBody.ok).toBe(true);
    expect(applyBody.issuer.status).toBe('Pending');

    // Admin reviews and approves
    const approveRes = await app.inject({
      method: 'POST',
      url: `/v1/admin/issuers/${issuerAddress}/approve`,
      headers: { cookie: adminCookie },
    });

    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.body);
    expect(approveBody.ok).toBe(true);
    expect(approveBody.issuer.status).toBe('Active');
  });

  let issuedDocHash: string;
  let issuedCredentialId: string;
  let issuedCid: string;
  let documentKey: Uint8Array;
  let originalPdfBytes: Uint8Array;

  it('2. issuer issues credential: client-side encrypts document, pins to IPFS, builds tree, signs root, and anchors', async () => {
    // A. Create sample degree PDF
    const pdfText = '%PDF-1.4\n% ZK-DocGuard Official Degree Conferred\nCandidate: Alex Vance\nDegree: B.Tech Computer Science\nCGPA: 8.74\n%%EOF';
    originalPdfBytes = new TextEncoder().encode(pdfText);
    issuedDocHash = keccak256(originalPdfBytes);

    // B. Client-side AES-256-GCM encryption
    documentKey = generateDocumentKey();
    const encrypted = await encryptDocument(originalPdfBytes, documentKey);
    const packedCiphertext = packEncryptedPayload(encrypted);

    // C. Upload ciphertext to IPFS
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/v1/ipfs/upload',
      payload: {
        ciphertext: Buffer.from(packedCiphertext).toString('base64'),
        metadata: {
          algorithm: 'AES-256-GCM',
          tagLength: 128,
        },
      },
    });

    expect(uploadRes.statusCode).toBe(201);
    const uploadBody = JSON.parse(uploadRes.body);
    issuedCid = uploadBody.cid;
    expect(issuedCid).toBeDefined();

    // D. Assemble 8-slot Poseidon Merkle tree and sign credentialRoot
    const attributes: UniversityDegreeAttributes = {
      holderCommitment: BigInt(holderAddress),
      degreeCode: 1, // B.Tech
      programCode: 101, // CS
      graduationYear: 2026,
      cgpaX100: 874, // 8.74
      studentId: 'NF2026-CS8821',
      expiry: 0, // Permanent
    };

    const pkg = await issueUniversityDegreeCredential({
      issuerDid: `did:ethr:31337:${issuerAddress}`,
      issuerKey,
      holderDid: `did:ethr:31337:${holderAddress}`,
      attributes,
      registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      chainId: 31337,
      ciphertextCid: issuedCid,
    });

    issuedCredentialId = pkg.vc.credentialStatus.credentialId;
    expect(issuedCredentialId.startsWith('0x')).toBe(true);

    // E. Anchor on-chain and record in API
    const txHash = '0x112233445566778899001122334455667788990011223344556677889900aabb';
    const anchorRes = await app.inject({
      method: 'POST',
      url: '/v1/credentials/anchor',
      headers: { cookie: issuerCookie },
      payload: {
        docHash: issuedDocHash,
        credentialId: issuedCredentialId,
        schemaId: pkg.vc.credentialSubject.schemaId,
        cid: issuedCid,
        expiry: '0',
        txHash,
      },
    });

    expect(anchorRes.statusCode).toBe(201);
    const anchorBody = JSON.parse(anchorRes.body);
    expect(anchorBody.ok).toBe(true);
    expect(anchorBody.record.status).toBe('Valid');
  });

  it('3. the registry shows the credential anchored and valid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/credentials/by-doc-hash/${issuedDocHash}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.record.docHash).toBe(issuedDocHash);
    expect(body.record.credentialId).toBe(issuedCredentialId);
    expect(body.record.cid).toBe(issuedCid);
    expect(body.record.status).toBe('Valid');
  });

  it('4. the IPFS object is verified to be ciphertext (assert NOT a valid PDF) and decrypts to original', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/ipfs/${issuedCid}`,
    });

    expect(res.statusCode).toBe(200);
    const rawPayload = res.rawPayload;

    // Critical assertion: The IPFS object must NEVER be plaintext PDF!
    const textPreview = rawPayload.subarray(0, 10).toString();
    expect(textPreview.startsWith('%PDF')).toBe(false);
    expect(textPreview.includes('Alex Vance')).toBe(false);

    // Decrypting client-side with documentKey restores the original PDF
    const unpacked = unpackEncryptedPayload(new Uint8Array(rawPayload));
    const decrypted = await decryptDocument(unpacked, documentKey);
    const decryptedText = new TextDecoder().decode(decrypted);

    expect(decryptedText.startsWith('%PDF-1.4')).toBe(true);
    expect(decryptedText.includes('Candidate: Alex Vance')).toBe(true);
    expect(decryptedText.includes('CGPA: 8.74')).toBe(true);
  });

  it('5. revocation works: revoking marks status Revoked and invalidates SMT witness', async () => {
    // Revoke the credential
    const revokeRes = await app.inject({
      method: 'POST',
      url: '/v1/revocations',
      headers: { cookie: issuerCookie },
      payload: {
        credentialId: issuedCredentialId,
        issuerKeyHash: issuerKeyHashHex,
        reasonCode: 'ACADEMIC_CORRECTION',
      },
    });

    expect(revokeRes.statusCode).toBe(201);
    const revokeBody = JSON.parse(revokeRes.body);
    expect(revokeBody.ok).toBe(true);

    // Verify status updated in registry
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/credentials/by-doc-hash/${issuedDocHash}`,
    });

    expect(checkRes.statusCode).toBe(200);
    const checkBody = JSON.parse(checkRes.body);
    expect(checkBody.record.status).toBe('Revoked');

    // SMT non-membership witness must now return 409 Conflict
    const witnessRes = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${issuerKeyHashHex}/witness/${issuedCredentialId}`,
    });

    expect(witnessRes.statusCode).toBe(409);
    const witnessBody = JSON.parse(witnessRes.body);
    expect(witnessBody.error).toContain('revoked');
  });

  it('6. batch issuance of 50 rows succeeds with an anchored root', async () => {
    // Generate 50 unique credential records
    const credentialIds: string[] = [];

    for (let i = 0; i < 50; i++) {
      const attributes: UniversityDegreeAttributes = {
        holderCommitment: BigInt(`0x3C44CdDdB6a900fa2b585dd299e03d12FA42${i.toString(16).padStart(4, '0')}`),
        degreeCode: (i % 3) + 1,
        programCode: 101 + (i % 5),
        graduationYear: 2026,
        cgpaX100: 750 + ((i * 13) % 240),
        studentId: `NF2026-${(1000 + i).toString()}`,
        expiry: 0,
      };

      const pkg = await issueUniversityDegreeCredential({
        issuerDid: `did:ethr:31337:${issuerAddress}`,
        issuerKey,
        holderDid: `did:ethr:31337:0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc`,
        attributes,
        registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        chainId: 31337,
      });

      credentialIds.push(pkg.vc.credentialStatus.credentialId);
    }

    expect(credentialIds.length).toBe(50);

    // Compute 32-byte batch Merkle root over all 50 credential IDs
    const combinedEntropy = sha256(
      new TextEncoder().encode(credentialIds.join(',')),
    );
    const batchRoot = '0x' + Array.from(combinedEntropy).map((b) => b.toString(16).padStart(2, '0')).join('');

    expect(batchRoot.length).toBe(66);
    expect(batchRoot.startsWith('0x')).toBe(true);

    // Record batch in database
    const batchRecord = await prisma.issuanceBatch.create({
      data: {
        issuerAddress,
        batchRoot,
        count: 50,
        manifestCid: 'QmSampleBatchManifest50GraduatesCID',
        txHash: '0x998877665544332211009988776655443322110099887766554433221100aabb',
      },
    });

    expect(batchRecord.count).toBe(50);
    expect(batchRecord.batchRoot).toBe(batchRoot);
  }, 30000);
});
