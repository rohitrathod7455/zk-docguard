import { buildEddsa, Eddsa } from 'circomlibjs';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { computeIssuerKeyHash } from './poseidon.js';

let cachedEddsa: Eddsa | null = null;

export const EDDSA_DERIVATION_SALT = new TextEncoder().encode('zk-docguard-babyjubjub-v1');
export const EDDSA_DERIVATION_INFO = new TextEncoder().encode('babyjubjub-eddsa-poseidon-key');

export const WALLET_DERIVATION_MESSAGE =
  'ZK-DocGuard: Derive Institutional Proving Key\nNetwork: EVM\nEpoch: 1';

export interface BabyJubKeyPair {
  privateKey: Uint8Array;
  publicKey: {
    x: bigint;
    y: bigint;
  };
  keyHash: bigint;
}

export interface EdDSASignature {
  R8x: bigint;
  R8y: bigint;
  S: bigint;
}

/**
 * @notice Initializes and caches the circomlibjs EdDSA instance.
 */
export async function getEddsa(): Promise<Eddsa> {
  if (!cachedEddsa) {
    cachedEddsa = await buildEddsa();
  }
  return cachedEddsa;
}

/**
 * @notice Derives a BabyJubJub EdDSA private key from an Ethereum wallet signature (e.g. personal_sign).
 * @dev Caveat: The signer wallet must generate deterministic signatures (RFC 6979) to reproduce
 *      the same proving key upon subsequent logins.
 * @param walletSignatureHex The 65-byte hex signature from personal_sign.
 * @returns 32-byte private key suitable for BabyJubJub EdDSA.
 */
export function deriveBabyJubPrivateKeyFromSignature(walletSignatureHex: string): Uint8Array {
  const cleanHex = walletSignatureHex.startsWith('0x')
    ? walletSignatureHex.slice(2)
    : walletSignatureHex;

  if (cleanHex.length !== 130) {
    throw new Error(
      `Invalid signature length: expected 130 hex chars (65 bytes), got ${cleanHex.length}`,
    );
  }

  const sigBytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

  // Derive 32-byte entropy via HKDF-SHA256
  const derivedKey = hkdf(sha256, sigBytes, EDDSA_DERIVATION_SALT, EDDSA_DERIVATION_INFO, 32);
  return derivedKey;
}

/**
 * @notice Derives a full BabyJubJub keypair and public key hash from a 32-byte private key.
 */
export async function deriveBabyJubKeyPair(privateKey: Uint8Array): Promise<BabyJubKeyPair> {
  const eddsa = await getEddsa();
  const pub = eddsa.prv2pub(privateKey);
  const Ax = eddsa.babyJub.F.toObject(pub[0]);
  const Ay = eddsa.babyJub.F.toObject(pub[1]);
  const keyHash = await computeIssuerKeyHash(Ax, Ay);

  return {
    privateKey,
    publicKey: { x: Ax, y: Ay },
    keyHash,
  };
}

/**
 * @notice Signs a Poseidon field element (e.g. credentialRoot) using BabyJubJub EdDSA-Poseidon.
 * @param privateKey 32-byte BabyJubJub private key.
 * @param msgFieldElement The field element message to sign.
 * @returns The EdDSA signature (R8x, R8y, S).
 */
export async function signCredentialRoot(
  privateKey: Uint8Array,
  msgFieldElement: bigint,
): Promise<EdDSASignature> {
  const eddsa = await getEddsa();
  const msgElem = eddsa.babyJub.F.e(msgFieldElement);
  const sig = eddsa.signPoseidon(privateKey, msgElem);

  const R8x = eddsa.babyJub.F.toObject(sig.R8[0]);
  const R8y = eddsa.babyJub.F.toObject(sig.R8[1]);
  const S = sig.S;

  return { R8x, R8y, S };
}

/**
 * @notice Verifies an EdDSA-Poseidon signature against a message and public key.
 * @param msgFieldElement The field element message that was signed.
 * @param sig The signature (R8x, R8y, S).
 * @param pubKey The public key (x, y).
 * @returns True if the signature is valid.
 */
export async function verifyCredentialSignature(
  msgFieldElement: bigint,
  sig: EdDSASignature,
  pubKey: { x: bigint; y: bigint },
): Promise<boolean> {
  const eddsa = await getEddsa();
  const msgElem = eddsa.babyJub.F.e(msgFieldElement);
  const rawSig = {
    R8: [eddsa.babyJub.F.e(sig.R8x), eddsa.babyJub.F.e(sig.R8y)] as [bigint, bigint],
    S: sig.S,
  };
  const rawPub = [eddsa.babyJub.F.e(pubKey.x), eddsa.babyJub.F.e(pubKey.y)] as [bigint, bigint];

  return eddsa.verifyPoseidon(msgElem, rawSig, rawPub);
}
