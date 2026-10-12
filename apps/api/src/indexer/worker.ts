import { createPublicClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { prisma } from '../db/client.js';

export interface IndexerConfig {
  rpcUrl?: string;
  pollingIntervalMs?: number;
  confirmationDepth?: number;
}

export class BlockchainIndexer {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private lastIndexedBlock = 0n;
  private readonly confirmationDepth: bigint;
  private readonly client: ReturnType<typeof createPublicClient> | null;

  constructor(config?: IndexerConfig) {
    this.confirmationDepth = BigInt(config?.confirmationDepth ?? 0);
    const rpcUrl = config?.rpcUrl || process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';
    try {
      this.client = createPublicClient({
        chain: hardhat,
        transport: http(rpcUrl),
      });
    } catch {
      this.client = null;
    }
  }

  getLastIndexedBlock(): bigint {
    return this.lastIndexedBlock;
  }

  setLastIndexedBlock(blockNumber: bigint): void {
    this.lastIndexedBlock = blockNumber;
  }

  /**
   * @notice Ingests and updates state for an IssuerApplied event.
   */
  async handleIssuerApplied(event: {
    issuer: string;
    did: string;
    zkKeyHash: string;
    metadataURI: string;
  }): Promise<void> {
    const address = event.issuer.toLowerCase();
    await prisma.issuer.upsert({
      where: { address },
      update: {
        did: event.did,
        zkKeyHash: event.zkKeyHash,
        metadataURI: event.metadataURI,
        status: 'Pending',
      },
      create: {
        address,
        did: event.did,
        zkKeyHash: event.zkKeyHash,
        metadataURI: event.metadataURI,
        status: 'Pending',
      },
    });
  }

  /**
   * @notice Ingests and updates state for an IssuerApproved event.
   */
  async handleIssuerApproved(issuerAddress: string): Promise<void> {
    const address = issuerAddress.toLowerCase();
    await prisma.issuer.updateMany({
      where: { address },
      data: {
        status: 'Active',
        approvedAt: new Date(),
      },
    });
  }

  /**
   * @notice Ingests and updates state for an IssuerSuspended event.
   */
  async handleIssuerSuspended(issuerAddress: string): Promise<void> {
    const address = issuerAddress.toLowerCase();
    await prisma.issuer.updateMany({
      where: { address },
      data: { status: 'Suspended' },
    });
  }

  /**
   * @notice Ingests and updates state for an IssuerReinstated event.
   */
  async handleIssuerReinstated(issuerAddress: string): Promise<void> {
    const address = issuerAddress.toLowerCase();
    await prisma.issuer.updateMany({
      where: { address },
      data: { status: 'Active' },
    });
  }

  /**
   * @notice Ingests and updates state for an IssuerRevoked event.
   */
  async handleIssuerRevoked(issuerAddress: string): Promise<void> {
    const address = issuerAddress.toLowerCase();
    await prisma.issuer.updateMany({
      where: { address },
      data: { status: 'Revoked' },
    });
  }

  /**
   * @notice Ingests and updates state for a KeyRotated event.
   */
  async handleKeyRotated(event: {
    issuer: string;
    newZkKeyHash: string;
    keyEpoch: number;
  }): Promise<void> {
    const address = event.issuer.toLowerCase();
    await prisma.issuer.updateMany({
      where: { address },
      data: {
        zkKeyHash: event.newZkKeyHash,
        keyEpoch: event.keyEpoch,
      },
    });
  }

  /**
   * @notice Ingests and updates state for a DocumentRegistered event.
   */
  async handleDocumentRegistered(event: {
    docHash: string;
    issuer: string;
    credentialId: string;
    schemaId: string;
    cid: string;
    expiry: bigint;
    txHash?: string;
  }): Promise<void> {
    const issuerAddress = event.issuer.toLowerCase();
    await prisma.credentialRecord.upsert({
      where: { docHash: event.docHash },
      update: {
        credentialId: event.credentialId,
        schemaId: event.schemaId,
        cid: event.cid,
        status: 'Valid',
        expiry: event.expiry,
        issuerAddress,
        txHash: event.txHash,
      },
      create: {
        docHash: event.docHash,
        credentialId: event.credentialId,
        schemaId: event.schemaId,
        cid: event.cid,
        status: 'Valid',
        expiry: event.expiry,
        issuerAddress,
        txHash: event.txHash,
      },
    });
  }

  /**
   * @notice Ingests and updates state for a BatchRegistered event.
   */
  async handleBatchRegistered(event: {
    batchRoot: string;
    issuer: string;
    count: number;
    manifestCid: string;
    txHash?: string;
  }): Promise<void> {
    const issuerAddress = event.issuer.toLowerCase();
    await prisma.issuanceBatch.create({
      data: {
        issuerAddress,
        batchRoot: event.batchRoot,
        count: event.count,
        manifestCid: event.manifestCid,
        txHash: event.txHash,
      },
    });
  }

  /**
   * @notice Ingests and updates state for a DocumentRevoked event.
   */
  async handleDocumentRevoked(docHash: string): Promise<void> {
    await prisma.credentialRecord.updateMany({
      where: { docHash },
      data: { status: 'Revoked' },
    });
  }

  /**
   * @notice Ingests and updates state for a CredentialRevoked event.
   */
  async handleCredentialRevoked(event: {
    credentialId: string;
    issuerKeyHash?: string;
    issuerAddress?: string;
  }): Promise<void> {
    const issuerKeyHash = event.issuerKeyHash || '0x0000000000000000000000000000000000000000000000000000000000000000';
    await prisma.revocationLeaf.upsert({
      where: {
        issuerKeyHash_credentialId: {
          issuerKeyHash,
          credentialId: event.credentialId,
        },
      },
      update: {
        revokedAt: new Date(),
        issuerAddress: event.issuerAddress?.toLowerCase(),
      },
      create: {
        issuerKeyHash,
        credentialId: event.credentialId,
        issuerAddress: event.issuerAddress?.toLowerCase(),
      },
    });

    // Also mark in CredentialRecord if present
    await prisma.credentialRecord.updateMany({
      where: { credentialId: event.credentialId },
      data: { status: 'Revoked' },
    });
  }

  /**
   * @notice Simulates or executes reorg recovery by rolling back to a safe block height.
   */
  async handleReorgRollback(safeBlock: bigint): Promise<void> {
    this.lastIndexedBlock = safeBlock;
    // Audit log reorg event
    await prisma.auditLog.create({
      data: {
        action: 'CHAIN_REORG_RECOVERY',
        actor: 'system',
        details: JSON.stringify({ rollbackToBlock: safeBlock.toString() }),
      },
    });
  }

  /**
   * @notice Starts the background event polling loop.
   */
  start(intervalMs = 3000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.pollNextBlocks().catch(() => {
        // Suppress unhandled network disconnect errors during polling
      });
    }, intervalMs);
  }

  /**
   * @notice Stops the background event polling loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async pollNextBlocks(): Promise<void> {
    if (!this.client) return;
    try {
      const latest = await this.client.getBlockNumber();
      const safeLatest = latest - this.confirmationDepth;
      if (safeLatest > this.lastIndexedBlock) {
        // Advance block pointer
        this.lastIndexedBlock = safeLatest;
      }
    } catch {
      // RPC temporarily unreachable
    }
  }
}

export const blockchainIndexer = new BlockchainIndexer();
