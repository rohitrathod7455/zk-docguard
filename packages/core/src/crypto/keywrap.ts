import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { encryptDocument, decryptDocument } from './encryption.js';

export const KEYWRAP_HKDF_INFO = new TextEncoder().encode('zk-docguard-x25519-keywrap-v1');

export interface WrappedKeyPackage {
  ephemeralPublicKey: string; // Hex string (32 bytes = 64 chars)
  iv: string; // Hex string (12 bytes = 24 chars)
  wrappedKey: string; // Hex string (32 bytes key + 16 bytes tag = 96 chars)
  expiresAt?: number; // Optional UNIX seconds for time-limited verifier sharing
}

export interface X25519KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * @notice Generates a fresh X25519 keypair for key wrapping.
 */
export function generateX25519KeyPair(): X25519KeyPair {
  const { secretKey, publicKey } = x25519.keygen();
  return { privateKey: secretKey, publicKey };
}

/**
 * @notice Wraps a symmetric document key to a recipient's X25519 public key using ECIES
 *         (X25519 ECDH + HKDF-SHA256 + AES-256-GCM).
 * @param symmetricKey 32-byte AES document key.
 * @param recipientPublicKey 32-byte X25519 public key of the recipient (holder or verifier).
 * @param expiresAt Optional UNIX timestamp for verifier-scoped time-limited shares.
 * @returns WrappedKeyPackage containing ephemeral public key and wrapped key ciphertext.
 */
export async function wrapDocumentKey(
  symmetricKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  expiresAt?: number,
): Promise<WrappedKeyPackage> {
  if (symmetricKey.length !== 32) {
    throw new Error(`Symmetric key must be 32 bytes, got ${symmetricKey.length}`);
  }
  if (recipientPublicKey.length !== 32) {
    throw new Error(`Recipient public key must be 32 bytes, got ${recipientPublicKey.length}`);
  }

  // Generate ephemeral keypair
  const ephemeral = generateX25519KeyPair();

  // Compute ECDH shared secret
  const sharedSecret = x25519.getSharedSecret(ephemeral.privateKey, recipientPublicKey);

  // Contextual info optionally binding expiration
  const info = expiresAt
    ? new TextEncoder().encode(`zk-docguard-x25519-keywrap-v1:${expiresAt}`)
    : KEYWRAP_HKDF_INFO;

  // Derive wrapping key
  const wrappingKey = hkdf(sha256, sharedSecret, undefined, info, 32);

  // Encrypt symmetric key with wrapping key
  const encrypted = await encryptDocument(symmetricKey, wrappingKey);

  return {
    ephemeralPublicKey: toHex(ephemeral.publicKey),
    iv: toHex(encrypted.iv),
    wrappedKey: toHex(encrypted.ciphertext),
    expiresAt,
  };
}

/**
 * @notice Unwraps a wrapped document key using the recipient's X25519 private key.
 * @dev Reverts if the ephemeral key or ciphertext is tampered with or expired.
 * @param pkg WrappedKeyPackage.
 * @param recipientPrivateKey 32-byte X25519 private key.
 * @param currentTimestamp Optional timestamp to enforce time-limited expiry check.
 * @returns Original 32-byte AES document key.
 */
export async function unwrapDocumentKey(
  pkg: WrappedKeyPackage,
  recipientPrivateKey: Uint8Array,
  currentTimestamp?: number,
): Promise<Uint8Array> {
  if (recipientPrivateKey.length !== 32) {
    throw new Error(`Recipient private key must be 32 bytes, got ${recipientPrivateKey.length}`);
  }

  // Check expiration if specified
  if (pkg.expiresAt !== undefined) {
    const now = currentTimestamp ?? Math.floor(Date.now() / 1000);
    if (now > pkg.expiresAt) {
      throw new Error(`Wrapped key expired at ${pkg.expiresAt} (current time: ${now})`);
    }
  }

  const ephemeralPublicKey = fromHex(pkg.ephemeralPublicKey);
  const iv = fromHex(pkg.iv);
  const ciphertext = fromHex(pkg.wrappedKey);

  // Compute ECDH shared secret
  const sharedSecret = x25519.getSharedSecret(recipientPrivateKey, ephemeralPublicKey);

  // Derive wrapping key
  const info = pkg.expiresAt
    ? new TextEncoder().encode(`zk-docguard-x25519-keywrap-v1:${pkg.expiresAt}`)
    : KEYWRAP_HKDF_INFO;

  const wrappingKey = hkdf(sha256, sharedSecret, undefined, info, 32);

  // Decrypt symmetric key
  return decryptDocument({ iv, ciphertext }, wrappingKey);
}

/**
 * @notice Creates a verifier-scoped, time-limited ephemeral share of a document key.
 * @param documentKey 32-byte symmetric AES-256 document key.
 * @param verifierPublicKey 32-byte X25519 public key generated ephemerally by the verifier.
 * @param ttlSeconds Lifetime of the sharing link in seconds (e.g. 900 for 15 minutes).
 * @returns WrappedKeyPackage with cryptographic expiresAt binding.
 */
export async function createVerifierEphemeralShare(
  documentKey: Uint8Array,
  verifierPublicKey: Uint8Array,
  ttlSeconds: number,
): Promise<WrappedKeyPackage> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return wrapDocumentKey(documentKey, verifierPublicKey, expiresAt);
}

/**
 * @notice Verifier unwraps a time-limited ephemeral share using their ephemeral X25519 private key.
 * @param pkg WrappedKeyPackage.
 * @param verifierPrivateKey 32-byte X25519 private key.
 * @returns Original 32-byte document key.
 */
export async function decryptVerifierEphemeralShare(
  pkg: WrappedKeyPackage,
  verifierPrivateKey: Uint8Array,
  currentTimestamp?: number,
): Promise<Uint8Array> {
  return unwrapDocumentKey(pkg, verifierPrivateKey, currentTimestamp);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}
