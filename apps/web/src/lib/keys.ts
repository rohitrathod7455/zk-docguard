/**
 * Institutional BabyJubJub key derivation and storage manager
 */

import {
  deriveBabyJubKeyPair,
  computeIssuerKeyHash,
  fieldToHex,
  BabyJubKeyPair,
} from '@zk-docguard/core';
import { sha256 } from '@noble/hashes/sha2.js';

export interface StoredIssuerKey {
  address: string;
  privateKeyHex: string;
  publicKey: {
    x: string;
    y: string;
  };
  keyHashHex: string;
  epoch: number;
  derivedAt: string;
}

const STORAGE_PREFIX = 'zkdg_issuer_key_';

/**
 * Derives a deterministic BabyJubJub keypair for an issuer address + epoch
 */
export async function deriveIssuerBabyJubKey(
  address: string,
  epoch = 1,
): Promise<{ keyPair: BabyJubKeyPair; keyHashHex: string; privateKeyHex: string }> {
  // Deterministic seed derivation based on institutional address and epoch
  const seedString = `ZK-DocGuard-Issuer-Proving-Key:${address.toLowerCase()}:epoch-${epoch}`;
  const seedBytes = new TextEncoder().encode(seedString);
  const rawEntropy = sha256(seedBytes);

  const keyPair = await deriveBabyJubKeyPair(rawEntropy);
  const keyHash = await computeIssuerKeyHash(keyPair.publicKey.x, keyPair.publicKey.y);
  const keyHashHex = fieldToHex(keyHash);
  const privateKeyHex = Array.from(rawEntropy, (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

  return { keyPair, keyHashHex, privateKeyHex };
}

/**
 * Loads or initializes the stored BabyJubJub key for an issuer address
 */
export async function getOrDeriveIssuerKey(
  address: string,
): Promise<StoredIssuerKey> {
  const normAddress = address.toLowerCase();
  const storageKey = `${STORAGE_PREFIX}${normAddress}`;

  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        const parsed: StoredIssuerKey = JSON.parse(cached);
        return parsed;
      } catch {
        // Fall through to re-derivation
      }
    }
  }

  const { keyPair, keyHashHex, privateKeyHex } = await deriveIssuerBabyJubKey(normAddress, 1);

  const stored: StoredIssuerKey = {
    address: normAddress,
    privateKeyHex,
    publicKey: {
      x: keyPair.publicKey.x.toString(),
      y: keyPair.publicKey.y.toString(),
    },
    keyHashHex,
    epoch: 1,
    derivedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify(stored));
  }

  return stored;
}

/**
 * Rotates the issuer's BabyJubJub key to the next epoch
 */
export async function rotateIssuerKey(
  address: string,
  currentEpoch: number,
): Promise<StoredIssuerKey> {
  const normAddress = address.toLowerCase();
  const nextEpoch = currentEpoch + 1;
  const storageKey = `${STORAGE_PREFIX}${normAddress}`;

  const { keyPair, keyHashHex, privateKeyHex } = await deriveIssuerBabyJubKey(normAddress, nextEpoch);

  const stored: StoredIssuerKey = {
    address: normAddress,
    privateKeyHex,
    publicKey: {
      x: keyPair.publicKey.x.toString(),
      y: keyPair.publicKey.y.toString(),
    },
    keyHashHex,
    epoch: nextEpoch,
    derivedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify(stored));
  }

  return stored;
}

/**
 * Restores a full BabyJubKeyPair from stored hex strings
 */
export async function restoreKeyPair(stored: StoredIssuerKey): Promise<BabyJubKeyPair> {
  const privBytes = new Uint8Array(
    stored.privateKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  return deriveBabyJubKeyPair(privBytes);
}

/**
 * Resolves the BabyJubJub public key for an issuer from DID or package
 */
export async function resolveIssuerPublicKey(
  issuerDid: string,
  pkg?: unknown,
): Promise<{ x: bigint; y: bigint }> {
  const custom = (pkg as { issuerPublicKey?: { x: string; y: string } })?.issuerPublicKey
    || (pkg as { vc?: { proof?: { issuerPublicKey?: { x: string; y: string } } } })?.vc?.proof?.issuerPublicKey;
  if (custom && custom.x && custom.y) {
    return { x: BigInt(custom.x), y: BigInt(custom.y) };
  }
  const parts = issuerDid.split(':');
  const address = parts[parts.length - 1] || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const { keyPair } = await deriveIssuerBabyJubKey(address);
  return keyPair.publicKey;
}

