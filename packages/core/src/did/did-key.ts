import { ed25519, x25519 } from '@noble/curves/ed25519.js';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * @notice Base58btc encoding without checksum.
 */
export function encodeBase58(bytes: Uint8Array): string {
  let zeroes = 0;
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeroes++;
  }

  let bi = 0n;
  for (let i = 0; i < bytes.length; i++) {
    bi = (bi << 8n) | BigInt(bytes[i]!);
  }

  let str = '';
  while (bi > 0n) {
    const mod = Number(bi % 58n);
    bi = bi / 58n;
    str = BASE58_ALPHABET[mod] + str;
  }

  return '1'.repeat(zeroes) + str;
}

/**
 * @notice Base58btc decoding.
 */
export function decodeBase58(str: string): Uint8Array {
  let zeroes = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    zeroes++;
  }

  let bi = 0n;
  for (let i = 0; i < str.length; i++) {
    const index = BASE58_ALPHABET.indexOf(str[i]!);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${str[i]}`);
    }
    bi = bi * 58n + BigInt(index);
  }

  const bytes: number[] = [];
  while (bi > 0n) {
    bytes.unshift(Number(bi & 0xffn));
    bi = bi >> 8n;
  }

  const result = new Uint8Array(zeroes + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[zeroes + i] = bytes[i]!;
  }
  return result;
}

export interface HolderIdentity {
  did: string;
  ed25519PrivateKey: Uint8Array;
  ed25519PublicKey: Uint8Array;
  x25519PrivateKey: Uint8Array;
  x25519PublicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  getHolderCommitment(): Promise<bigint>;
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
    publicKeyJwk?: Record<string, unknown>;
  }>;
  authentication: string[];
  assertionMethod: string[];
  keyAgreement?: string[];
}

/**
 * @notice Generates a gasless browser-based holder SSI identity (did:key).
 * @param customSeed Optional 32-byte seed; generated randomly if omitted.
 */
export function createHolderIdentity(customSeed?: Uint8Array): HolderIdentity {
  const seed = customSeed ?? ed25519.utils.randomSecretKey();
  const edPubKey = ed25519.getPublicKey(seed);

  // ed25519-pub multicodec prefix: 0xed, 0x01
  const prefixed = new Uint8Array(2 + edPubKey.length);
  prefixed[0] = 0xed;
  prefixed[1] = 0x01;
  prefixed.set(edPubKey, 2);

  const did = `did:key:z${encodeBase58(prefixed)}`;

  // Convert Ed25519 key to X25519 for key agreement / document encryption
  const x25519Priv = seed; // Can use seed directly for X25519 scalar
  const x25519Pub = x25519.getPublicKey(x25519Priv);

  return {
    did,
    ed25519PrivateKey: seed,
    ed25519PublicKey: edPubKey,
    x25519PrivateKey: x25519Priv,
    x25519PublicKey: x25519Pub,
    privateKey: seed,
    publicKey: edPubKey,
    async getHolderCommitment(): Promise<bigint> {
      const { poseidonHash } = await import('../crypto/poseidon.js');
      const { bytesToField253 } = await import('../crypto/fields.js');
      return poseidonHash([bytesToField253(seed)]);
    },
  };
}

/**
 * @notice Resolves a did:key DID to its standard W3C DID Document.
 */
export function resolveDidKey(did: string): DIDDocument {
  if (!did.startsWith('did:key:')) {
    throw new Error(`Invalid did:key format: ${did}`);
  }

  const multibase = did.slice('did:key:'.length);
  if (!multibase.startsWith('z')) {
    throw new Error(`did:key multibase must start with 'z' (base58btc), got: ${multibase}`);
  }

  const rawBytes = decodeBase58(multibase.slice(1)); // Remove leading 'z'

  if (rawBytes.length !== 34 || rawBytes[0] !== 0xed || rawBytes[1] !== 0x01) {
    throw new Error('Unsupported did:key algorithm (expected Ed25519 with 0xed01 prefix)');
  }

  const keyId = `${did}#${multibase}`;

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: multibase,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
  };
}
