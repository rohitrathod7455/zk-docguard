import { sha256 } from '@noble/hashes/sha2.js';

/**
 * @notice BN254 scalar field prime order (r).
 *         r = 21888242871839275222246405745257275088548364400416034343698204186575808495617
 */
export const BN254_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * @notice Mask for 253-bit truncation (guaranteed to be strictly less than BN254_PRIME).
 */
export const MASK_253_BITS = (1n << 253n) - 1n;

/**
 * @notice Validates whether a given bigint is a valid BN254 field element [0, BN254_PRIME - 1].
 */
export function isFieldElement(val: bigint): boolean {
  return val >= 0n && val < BN254_PRIME;
}

/**
 * @notice Coerces a value (number, bigint, hex string, or decimal string) into a BN254 field element.
 * @dev Reverts if the value is negative or exceeds the scalar field prime.
 */
export function toFieldElement(val: bigint | number | string): bigint {
  let bi: bigint;
  if (typeof val === 'bigint') {
    bi = val;
  } else if (typeof val === 'number') {
    if (!Number.isSafeInteger(val) || val < 0) {
      throw new Error(`Invalid numeric field element: ${val}`);
    }
    bi = BigInt(val);
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      bi = BigInt(trimmed);
    } else {
      bi = BigInt(trimmed);
    }
  } else {
    throw new Error(`Unsupported field element input type: ${typeof val}`);
  }

  if (bi < 0n || bi >= BN254_PRIME) {
    throw new Error(`Value ${bi} out of bounds for BN254 scalar field`);
  }
  return bi;
}

/**
 * @notice Deterministically encodes an arbitrary string into a BN254 field element.
 *         Algorithm:
 *           1. UTF-8 encode input string.
 *           2. Compute SHA-256 hash (32 bytes).
 *           3. Interpret hash as big-endian 256-bit integer.
 *           4. Truncate to lower 253 bits via bitwise AND with (2^253 - 1).
 *         Because 2^253 < BN254_PRIME (~2.1888e77 vs 2.18882428...e77), the result
 *         is guaranteed to be a valid field element without modulo reduction bias.
 * @param str Input string to encode.
 * @returns BN254 field element as BigInt.
 */
export function stringToField(str: string): bigint {
  const bytes = new TextEncoder().encode(str);
  const hash = sha256(bytes);
  return bytesToField253(hash);
}

/**
 * @notice Converts a byte array (e.g. SHA-256 digest) into a 253-bit BN254 field element.
 */
export function bytesToField253(bytes: Uint8Array): bigint {
  let bi = 0n;
  for (let i = 0; i < bytes.length; i++) {
    bi = (bi << 8n) | BigInt(bytes[i]!);
  }
  return bi & MASK_253_BITS;
}

/**
 * @notice Generates a cryptographically secure random 253-bit salt for attribute commitments.
 */
export function randomFieldElement(): bigint {
  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Node.js fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(randomBytes);
  }
  return bytesToField253(randomBytes);
}

export const generateRandomFieldElement = randomFieldElement;

/**
 * @notice Generates an array of cryptographically random 253-bit field element salts.
 */
export function generateSalts(count: number): bigint[] {
  const salts: bigint[] = [];
  for (let i = 0; i < count; i++) {
    salts.push(randomFieldElement());
  }
  return salts;
}

/**
 * @notice Formats a field element as a 0x-prefixed 32-byte hex string (64 characters).
 */
export function fieldToHex(field: bigint): string {
  if (!isFieldElement(field)) {
    throw new Error(`Invalid field element: ${field}`);
  }
  return '0x' + field.toString(16).padStart(64, '0');
}

/**
 * @notice Parses a hex string into a BN254 field element.
 */
export function hexToField(hex: string): bigint {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return toFieldElement(BigInt('0x' + (clean || '0')));
}
