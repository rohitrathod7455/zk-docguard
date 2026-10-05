/**
 * @notice Client-side AES-256-GCM authenticated encryption/decryption using WebCrypto.
 *         Ensures zero plaintext exposure to server or IPFS.
 */

export const AES_KEY_BYTES = 32; // 256 bits
export const GCM_IV_BYTES = 12; // 96 bits
export const GCM_TAG_BITS = 128; // 16 bytes

export interface EncryptedPayload {
  iv: Uint8Array;
  ciphertext: Uint8Array; // Includes authentication tag appended by WebCrypto
}

/**
 * @notice Resolves the active WebCrypto SubtleCrypto implementation (Node.js or browser).
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return (nodeCrypto.webcrypto as Crypto).subtle;
}

/**
 * @notice Generates a fresh random 256-bit AES-GCM symmetric key.
 */
export function generateDocumentKey(): Uint8Array {
  const key = new Uint8Array(AES_KEY_BYTES);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(key);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(key);
  }
  return key;
}

export const generateAESKey = generateDocumentKey;

/**
 * @notice Generates a fresh random 96-bit initialization vector.
 */
export function generateIV(): Uint8Array {
  const iv = new Uint8Array(GCM_IV_BYTES);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(iv);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(iv);
  }
  return iv;
}

/**
 * @notice Encrypts plaintext document bytes using AES-256-GCM.
 * @param plaintext Plaintext file bytes.
 * @param key 32-byte symmetric key.
 * @param customIV Optional 12-byte IV; fresh random IV generated if omitted.
 * @returns EncryptedPayload containing the IV and ciphertext with authentication tag.
 */
export async function encryptDocument(
  plaintext: Uint8Array,
  key: Uint8Array,
  customIV?: Uint8Array,
): Promise<EncryptedPayload> {
  if (key.length !== AES_KEY_BYTES) {
    throw new Error(`AES-256 key must be ${AES_KEY_BYTES} bytes, got ${key.length}`);
  }

  const iv = customIV ?? generateIV();
  if (iv.length !== GCM_IV_BYTES) {
    throw new Error(`AES-GCM IV must be ${GCM_IV_BYTES} bytes, got ${iv.length}`);
  }

  const subtle = getSubtleCrypto();
  const cryptoKey = await subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: GCM_TAG_BITS,
    },
    cryptoKey,
    plaintext as unknown as BufferSource,
  );

  return {
    iv,
    ciphertext: new Uint8Array(encryptedBuffer),
  };
}

/**
 * @notice Decrypts an AES-256-GCM ciphertext payload.
 * @dev Reverts if the ciphertext is tampered or the key/IV is invalid.
 * @param payload EncryptedPayload containing IV and ciphertext.
 * @param key 32-byte symmetric key.
 * @returns Plaintext bytes.
 */
export async function decryptDocument(
  payload: EncryptedPayload,
  key: Uint8Array,
): Promise<Uint8Array> {
  if (key.length !== AES_KEY_BYTES) {
    throw new Error(`AES-256 key must be ${AES_KEY_BYTES} bytes, got ${key.length}`);
  }
  if (payload.iv.length !== GCM_IV_BYTES) {
    throw new Error(`Invalid IV length: expected ${GCM_IV_BYTES}, got ${payload.iv.length}`);
  }

  const subtle = getSubtleCrypto();
  const cryptoKey = await subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: payload.iv as unknown as BufferSource,
        tagLength: GCM_TAG_BITS,
      },
      cryptoKey,
      payload.ciphertext as unknown as BufferSource,
    );
    return new Uint8Array(decryptedBuffer);
  } catch {
    throw new Error('Decryption failed: integrity check / authentication tag mismatch');
  }
}

/**
 * @notice Packs IV and ciphertext into a single byte stream suitable for IPFS storage.
 *         Layout: [12 bytes IV][Remaining bytes: ciphertext + 16 bytes tag]
 */
export function packEncryptedPayload(payload: EncryptedPayload): Uint8Array {
  const result = new Uint8Array(payload.iv.length + payload.ciphertext.length);
  result.set(payload.iv, 0);
  result.set(payload.ciphertext, payload.iv.length);
  return result;
}

/**
 * @notice Unpacks a combined byte stream into an EncryptedPayload.
 */
export function unpackEncryptedPayload(packed: Uint8Array): EncryptedPayload {
  if (packed.length < GCM_IV_BYTES + 16) {
    throw new Error('Packed payload too short to contain valid IV and authentication tag');
  }
  const iv = packed.slice(0, GCM_IV_BYTES);
  const ciphertext = packed.slice(GCM_IV_BYTES);
  return { iv, ciphertext };
}
