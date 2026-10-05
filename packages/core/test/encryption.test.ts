import { describe, it, expect } from 'vitest';
import {
  generateAESKey,
  generateIV,
  encryptDocument,
  decryptDocument,
  packEncryptedPayload,
  unpackEncryptedPayload,
  AES_KEY_BYTES,
  GCM_IV_BYTES,
} from '../src/crypto/encryption.js';

describe('AES-256-GCM Encryption (encryption.ts)', () => {
  it('generates cryptographically secure 32-byte keys and 12-byte IVs', () => {
    const key = generateAESKey();
    expect(key.length).toBe(AES_KEY_BYTES);

    const iv = generateIV();
    expect(iv.length).toBe(GCM_IV_BYTES);
  });

  it('encrypts and decrypts arbitrary plaintext round-trip', async () => {
    const key = generateAESKey();
    const message = 'Confidential degree certificate data: John Doe, B.Tech CSE 2026';
    const plaintext = new TextEncoder().encode(message);

    const encrypted = await encryptDocument(plaintext, key);
    expect(encrypted.iv.length).toBe(GCM_IV_BYTES);
    expect(encrypted.ciphertext.length).toBeGreaterThan(plaintext.length);

    const decrypted = await decryptDocument(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe(message);
  });

  it('packs and unpacks envelope payload (IV + Ciphertext) seamlessly', async () => {
    const key = generateAESKey();
    const plaintext = new TextEncoder().encode('Packed payload test');
    const encrypted = await encryptDocument(plaintext, key);

    const packed = packEncryptedPayload(encrypted);
    expect(packed.length).toBe(GCM_IV_BYTES + encrypted.ciphertext.length);

    const unpacked = unpackEncryptedPayload(packed);
    expect(unpacked.iv).toEqual(encrypted.iv);
    expect(unpacked.ciphertext).toEqual(encrypted.ciphertext);

    const decrypted = await decryptDocument(unpacked, key);
    expect(new TextDecoder().decode(decrypted)).toBe('Packed payload test');
  });

  it('rejects unpack of truncated payload (< 28 bytes)', () => {
    const tooShort = new Uint8Array(20);
    expect(() => unpackEncryptedPayload(tooShort)).toThrow('Packed payload too short');
  });

  it('fails decryption with wrong key', async () => {
    const key1 = generateAESKey();
    const key2 = generateAESKey();
    const plaintext = new TextEncoder().encode('Secret Document');

    const encrypted = await encryptDocument(plaintext, key1);
    await expect(decryptDocument(encrypted, key2)).rejects.toThrow('Decryption failed');
  });

  it('fails decryption when ciphertext is tampered (integrity verification)', async () => {
    const key = generateAESKey();
    const plaintext = new TextEncoder().encode('Integrity Document');

    const encrypted = await encryptDocument(plaintext, key);
    const tamperedCiphertext = new Uint8Array(encrypted.ciphertext);
    tamperedCiphertext[0] = tamperedCiphertext[0]! ^ 0xff; // Flip bits

    await expect(
      decryptDocument({ iv: encrypted.iv, ciphertext: tamperedCiphertext }, key),
    ).rejects.toThrow('Decryption failed');
  });

  it('fails decryption when IV is tampered', async () => {
    const key = generateAESKey();
    const plaintext = new TextEncoder().encode('Integrity Document');

    const encrypted = await encryptDocument(plaintext, key);
    const tamperedIV = new Uint8Array(encrypted.iv);
    tamperedIV[0] = tamperedIV[0]! ^ 0xff;

    await expect(
      decryptDocument({ iv: tamperedIV, ciphertext: encrypted.ciphertext }, key),
    ).rejects.toThrow('Decryption failed');
  });

  it('rejects invalid key lengths on encryption and decryption', async () => {
    const invalidKey = new Uint8Array(16);
    const plaintext = new Uint8Array(10);

    await expect(encryptDocument(plaintext, invalidKey)).rejects.toThrow(
      'AES-256 key must be 32 bytes',
    );
    await expect(
      decryptDocument({ iv: new Uint8Array(12), ciphertext: plaintext }, invalidKey),
    ).rejects.toThrow('AES-256 key must be 32 bytes');
  });
});
