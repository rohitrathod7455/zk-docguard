import { DIDDocument } from './did-key.js';
import { fieldToHex } from '../crypto/fields.js';

export interface IssuerIdentity {
  did: string;
  ethereumAddress: string;
  chainId: number;
  babyJubPublicKey: {
    x: bigint;
    y: bigint;
  };
  zkKeyHash: bigint;
}

/**
 * @notice Formats a did:ethr identifier from an Ethereum address and chainId.
 */
export function formatDidEthr(address: string, chainId: number = 80002): string {
  const cleanAddr = address.toLowerCase();
  if (chainId === 1) {
    return `did:ethr:${cleanAddr}`;
  }
  return `did:ethr:${chainId}:${cleanAddr}`;
}

/**
 * @notice Parses an Ethereum address from a did:ethr identifier.
 */
export function parseDidEthr(did: string): {
  address: string;
  chainId?: number;
  network?: string;
} {
  const parts = did.split(':');
  if (parts.length === 3 && parts[0] === 'did' && parts[1] === 'ethr') {
    return { address: parts[2]!.toLowerCase(), chainId: 1 };
  }
  if (parts.length === 4 && parts[0] === 'did' && parts[1] === 'ethr') {
    const netOrChain = parts[2]!;
    const chainNum = Number(netOrChain);
    if (!isNaN(chainNum) && Number.isInteger(chainNum)) {
      return { address: parts[3]!.toLowerCase(), chainId: chainNum };
    }
    return { address: parts[3]!.toLowerCase(), network: netOrChain };
  }
  throw new Error(`Invalid did:ethr identifier: ${did}`);
}

/**
 * @notice Constructs an extended W3C DID Document for an issuer including both standard
 *         Ethereum EcdsaSecp256k1RecoveryMethod2020 and custom ZkDocGuardBabyJubJubKey2026 verification methods.
 */
export function buildIssuerDidDocument(
  issuerOrDid: IssuerIdentity | string,
  babyJubPublicKey?: { x: bigint; y: bigint },
  zkKeyHash?: bigint,
): DIDDocument {
  let did: string;
  let ethereumAddress: string;
  let pubKey: { x: bigint; y: bigint };
  let keyHash: bigint;

  if (typeof issuerOrDid === 'string') {
    did = issuerOrDid;
    const parsed = parseDidEthr(did);
    ethereumAddress = parsed.address;
    if (!babyJubPublicKey) {
      throw new Error('babyJubPublicKey required when passing did string');
    }
    pubKey = babyJubPublicKey;
    keyHash = zkKeyHash ?? 0n;
  } else {
    did = issuerOrDid.did;
    ethereumAddress = issuerOrDid.ethereumAddress;
    pubKey = issuerOrDid.babyJubPublicKey;
    keyHash = issuerOrDid.zkKeyHash;
  }

  const ethKeyId = `${did}#controller`;
  const zkKeyId = `${did}#babyjubjub-1`;

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/secp256k1-recovery-2020/v1',
      'https://w3id.org/security/zk-docguard/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: ethKeyId,
        type: 'EcdsaSecp256k1RecoveryMethod2020',
        controller: did,
        publicKeyJwk: {
          kty: 'EC',
          crv: 'secp256k1',
          address: ethereumAddress,
        },
      },
      {
        id: zkKeyId,
        type: 'ZkDocGuardBabyJubJubKey2026',
        controller: did,
        publicKeyJwk: {
          kty: 'OKP',
          crv: 'BabyJubJub',
          x: fieldToHex(pubKey.x),
          y: fieldToHex(pubKey.y),
          zkKeyHash: fieldToHex(keyHash),
        },
      },
    ],
    authentication: [ethKeyId],
    assertionMethod: [ethKeyId, zkKeyId],
  };
}
