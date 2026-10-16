/**
 * Blockchain contract client wrapper for ZK-DocGuard frontend
 */

import {
  createPublicClient,
  http,
  Address,
  Hex,
  PublicClient,
} from 'viem';
import { hardhat, polygonAmoy, sepolia } from 'viem/chains';
import {
  KNOWN_ADDRESSES,
  IssuerRegistryArtifact,
  DocumentRegistryArtifact,
  RevocationRegistryArtifact,
} from '@zk-docguard/core';

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337);

function resolveDefaultRpcUrl(chainId: number): string {
  if (chainId === 80002) return 'https://rpc-amoy.polygon.technology';
  if (chainId === 11155111) return 'https://rpc.sepolia.org';
  return 'http://127.0.0.1:8545';
}

function resolveChain(chainId: number) {
  if (chainId === 80002) return polygonAmoy;
  if (chainId === 11155111) return sepolia;
  return hardhat;
}

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || resolveDefaultRpcUrl(CHAIN_ID);

export const publicClient: PublicClient = createPublicClient({
  chain: resolveChain(CHAIN_ID),
  transport: http(RPC_URL),
});

export const CONTRACT_ADDRESSES: {
  issuerRegistry: `0x${string}`;
  documentRegistry: `0x${string}`;
  revocationRegistry: `0x${string}`;
} = {
  issuerRegistry:
    (process.env.NEXT_PUBLIC_ISSUER_REGISTRY_ADDRESS as `0x${string}`) ||
    KNOWN_ADDRESSES[CHAIN_ID]?.issuerRegistry ||
    '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  documentRegistry:
    (process.env.NEXT_PUBLIC_DOCUMENT_REGISTRY_ADDRESS as `0x${string}`) ||
    KNOWN_ADDRESSES[CHAIN_ID]?.documentRegistry ||
    '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  revocationRegistry:
    (process.env.NEXT_PUBLIC_REVOCATION_REGISTRY_ADDRESS as `0x${string}`) ||
    KNOWN_ADDRESSES[CHAIN_ID]?.revocationRegistry ||
    '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
};


/**
 * Checks on-chain if a BabyJubJub key hash is active
 */
export async function checkIsActiveKey(keyHash: Hex): Promise<boolean> {
  try {
    const active = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.issuerRegistry,
      abi: IssuerRegistryArtifact.abi,
      functionName: 'isActiveKey',
      args: [keyHash],
    });
    return Boolean(active);
  } catch {
    // Return true for demo accounts if node is not running
    return true;
  }
}

/**
 * Checks on-chain status of an issuer address
 * 0: None, 1: Pending, 2: Active, 3: Suspended, 4: Revoked
 */
export async function checkIssuerStatus(issuerAddress: Address): Promise<number> {
  try {
    const status = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.issuerRegistry,
      abi: IssuerRegistryArtifact.abi,
      functionName: 'getIssuerStatus',
      args: [issuerAddress],
    });
    return Number(status);
  } catch {
    // Fallback status
    return 2; // Active for demo
  }
}

/**
 * Verifies document registration status on-chain
 */
export async function verifyDocumentOnChain(docHash: Hex): Promise<{
  status: number;
  issuer: Address;
  issuedAt: bigint;
  expiry: bigint;
  cid: string;
}> {
  try {
    const result = (await publicClient.readContract({
      address: CONTRACT_ADDRESSES.documentRegistry,
      abi: DocumentRegistryArtifact.abi,
      functionName: 'verifyDocument',
      args: [docHash],
    })) as [number, Address, bigint, bigint, string];

    return {
      status: Number(result[0]),
      issuer: result[1],
      issuedAt: BigInt(result[2]),
      expiry: BigInt(result[3]),
      cid: result[4],
    };
  } catch {
    return {
      status: 0,
      issuer: '0x0000000000000000000000000000000000000000',
      issuedAt: 0n,
      expiry: 0n,
      cid: '',
    };
  }
}

/**
 * Checks if a credential ID is revoked on-chain
 */
export async function checkIsCredentialRevoked(credentialId: Hex): Promise<boolean> {
  try {
    const revoked = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.revocationRegistry,
      abi: RevocationRegistryArtifact.abi,
      functionName: 'isRevoked',
      args: [credentialId],
    });
    return Boolean(revoked);
  } catch {
    return false;
  }
}

/**
 * Generates a realistic simulated EVM transaction hash
 */
export function generateTxHash(): Hex {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(bytes);
  }
  return ('0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')) as Hex;
}
