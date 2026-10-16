import { getContract, PublicClient, WalletClient, Address, Hex } from 'viem';
import IssuerRegistryArtifact from './IssuerRegistry.json';
import DocumentRegistryArtifact from './DocumentRegistry.json';
import RevocationRegistryArtifact from './RevocationRegistry.json';
import addressesData from './addresses.json';

export interface DeploymentAddresses {
  issuerRegistry: Address;
  documentRegistry: Address;
  revocationRegistry: Address;
}

export const KNOWN_ADDRESSES: Record<number, DeploymentAddresses> = {
  31337: {
    issuerRegistry: (addressesData.hardhat?.contracts?.IssuerRegistry?.address ?? '0x5FbDB2315678afecb367f032d93F642f64180aa3') as Address,
    documentRegistry: (addressesData.hardhat?.contracts?.DocumentRegistry?.address ?? '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as Address,
    revocationRegistry: (addressesData.hardhat?.contracts?.RevocationRegistry?.address ?? '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as Address,
  },
  80002: {
    issuerRegistry: ((addressesData as Record<string, any>).amoy?.contracts?.IssuerRegistry?.address ?? '0x5FbDB2315678afecb367f032d93F642f64180aa3') as Address,
    documentRegistry: ((addressesData as Record<string, any>).amoy?.contracts?.DocumentRegistry?.address ?? '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as Address,
    revocationRegistry: ((addressesData as Record<string, any>).amoy?.contracts?.RevocationRegistry?.address ?? '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as Address,
  },
};

/**
 * @notice Resolves registered contract addresses for a given chainId.
 */
export function getRegistryAddresses(chainId: number): DeploymentAddresses {
  const addresses = KNOWN_ADDRESSES[chainId];
  if (addresses) return addresses;

  // Search addressesData for dynamic deployments
  const data = addressesData as Record<string, any>;
  for (const net of Object.values(data)) {
    if (net && net.chainId === chainId && net.contracts) {
      return {
        issuerRegistry: net.contracts.IssuerRegistry?.address as Address,
        documentRegistry: net.contracts.DocumentRegistry?.address as Address,
        revocationRegistry: net.contracts.RevocationRegistry?.address as Address,
      };
    }
  }

  throw new Error(
    `No deployment addresses recorded for chain ID ${chainId}. Please provide explicit addresses.`,
  );
}

export interface ContractOptions {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  address?: Address;
}

/**
 * @notice Creates a viem contract instance for IssuerRegistry.
 */
export function getIssuerRegistryContract({
  publicClient,
  walletClient,
  address,
}: ContractOptions) {
  const targetAddress =
    address ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).issuerRegistry
      : undefined);

  if (!targetAddress) {
    throw new Error(
      'IssuerRegistry address must be specified or present in known chain deployments',
    );
  }

  return getContract({
    address: targetAddress,
    abi: IssuerRegistryArtifact.abi,
    client: { public: publicClient, wallet: walletClient },
  });
}

/**
 * @notice Creates a viem contract instance for DocumentRegistry.
 */
export function getDocumentRegistryContract({
  publicClient,
  walletClient,
  address,
}: ContractOptions) {
  const targetAddress =
    address ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).documentRegistry
      : undefined);

  if (!targetAddress) {
    throw new Error(
      'DocumentRegistry address must be specified or present in known chain deployments',
    );
  }

  return getContract({
    address: targetAddress,
    abi: DocumentRegistryArtifact.abi,
    client: { public: publicClient, wallet: walletClient },
  });
}

/**
 * @notice Creates a viem contract instance for RevocationRegistry.
 */
export function getRevocationRegistryContract({
  publicClient,
  walletClient,
  address,
}: ContractOptions) {
  const targetAddress =
    address ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).revocationRegistry
      : undefined);

  if (!targetAddress) {
    throw new Error(
      'RevocationRegistry address must be specified or present in known chain deployments',
    );
  }

  return getContract({
    address: targetAddress,
    abi: RevocationRegistryArtifact.abi,
    client: { public: publicClient, wallet: walletClient },
  });
}

/**
 * @notice Checks whether an issuer's ZK key is active on-chain (including active grace period).
 */
export async function isZkKeyActiveOnChain(
  publicClient: PublicClient,
  zkKeyHash: Hex,
  registryAddress?: Address,
): Promise<boolean> {
  const targetAddress =
    registryAddress ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).issuerRegistry
      : undefined);
  if (!targetAddress) {
    throw new Error('IssuerRegistry address not specified');
  }
  const isActive = await publicClient.readContract({
    address: targetAddress,
    abi: IssuerRegistryArtifact.abi,
    functionName: 'isActiveKey',
    args: [zkKeyHash],
  });
  return Boolean(isActive);
}

/**
 * @notice Checks whether an institution is currently approved and active.
 */
export async function getIssuerStatusOnChain(
  publicClient: PublicClient,
  issuerAddress: Address,
  registryAddress?: Address,
): Promise<number> {
  const targetAddress =
    registryAddress ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).issuerRegistry
      : undefined);
  if (!targetAddress) {
    throw new Error('IssuerRegistry address not specified');
  }
  const status = await publicClient.readContract({
    address: targetAddress,
    abi: IssuerRegistryArtifact.abi,
    functionName: 'getIssuerStatus',
    args: [issuerAddress],
  });
  return Number(status);
}

/**
 * @notice Verifies a document's registration status on-chain.
 */
export async function verifyDocumentOnChain(
  publicClient: PublicClient,
  docHash: Hex,
  registryAddress?: Address,
): Promise<{
  status: number;
  issuer: Address;
  issuedAt: bigint;
  validUntil: bigint;
  cid: string;
}> {
  const targetAddress =
    registryAddress ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).documentRegistry
      : undefined);
  if (!targetAddress) {
    throw new Error('DocumentRegistry address not specified');
  }
  const result = (await publicClient.readContract({
    address: targetAddress,
    abi: DocumentRegistryArtifact.abi,
    functionName: 'verifyDocument',
    args: [docHash],
  })) as [number, Address, bigint, bigint, string];

  return {
    status: result[0],
    issuer: result[1],
    issuedAt: result[2],
    validUntil: result[3],
    cid: result[4],
  };
}

/**
 * @notice Checks whether a credential has been revoked on-chain in RevocationRegistry.
 */
export async function isCredentialRevokedOnChain(
  publicClient: PublicClient,
  credentialId: Hex,
  registryAddress?: Address,
): Promise<boolean> {
  const targetAddress =
    registryAddress ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).revocationRegistry
      : undefined);
  if (!targetAddress) {
    throw new Error('RevocationRegistry address not specified');
  }
  const revoked = await publicClient.readContract({
    address: targetAddress,
    abi: RevocationRegistryArtifact.abi,
    functionName: 'isRevoked',
    args: [credentialId],
  });
  return Boolean(revoked);
}

/**
 * @notice Checks whether a given SMT root is valid in the issuer's on-chain root history.
 */
export async function isRevocationRootValidOnChain(
  publicClient: PublicClient,
  issuerKeyHash: Hex,
  root: Hex,
  registryAddress?: Address,
): Promise<boolean> {
  const targetAddress =
    registryAddress ??
    (publicClient.chain?.id
      ? getRegistryAddresses(publicClient.chain.id).revocationRegistry
      : undefined);
  if (!targetAddress) {
    throw new Error('RevocationRegistry address not specified');
  }
  const valid = await publicClient.readContract({
    address: targetAddress,
    abi: RevocationRegistryArtifact.abi,
    functionName: 'isValidRoot',
    args: [issuerKeyHash, root],
  });
  return Boolean(valid);
}
