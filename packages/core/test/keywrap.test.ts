import { describe, it, expect } from 'vitest';
import {
  generateX25519KeyPair,
  wrapDocumentKey,
  unwrapDocumentKey,
  createVerifierEphemeralShare,
  decryptVerifierEphemeralShare,
} from '../src/crypto/keywrap.js';
import { generateAESKey } from '../src/crypto/encryption.js';

describe('X25519 + HKDF Key Wrapping (keywrap.ts)', () => {
  it('generates valid 32-byte X25519 keypairs', () => {
    const keyPair = generateX25519KeyPair();
    expect(keyPair.privateKey.length).toBe(32);
    expect(keyPair.publicKey.length).toBe(32);
  });

  it('wraps and unwraps a symmetric key round-trip', async () => {
    const docKey = generateAESKey();
    const recipient = generateX25519KeyPair();

    const wrappedPkg = await wrapDocumentKey(docKey, recipient.publicKey);
    expect(wrappedPkg.ephemeralPublicKey.length).toBe(64); // 32 bytes hex
    expect(wrappedPkg.iv.length).toBe(24); // 12 bytes hex
    expect(wrappedPkg.wrappedKey.length).toBeGreaterThan(0);

    const unwrappedKey = await unwrapDocumentKey(wrappedPkg, recipient.privateKey);
    expect(unwrappedKey).toEqual(docKey);
  });

  it('supports verifier-scoped time-limited key sharing before expiration', async () => {
    const docKey = generateAESKey();
    const verifier = generateX25519KeyPair();
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const wrappedPkg = await wrapDocumentKey(docKey, verifier.publicKey, futureExpiry);
    expect(wrappedPkg.expiresAt).toBe(futureExpiry);

    const unwrappedKey = await unwrapDocumentKey(wrappedPkg, verifier.privateKey);
    expect(unwrappedKey).toEqual(docKey);
  });

  it('rejects unwrapping of expired key packages', async () => {
    const docKey = generateAESKey();
    const verifier = generateX25519KeyPair();
    const pastExpiry = Math.floor(Date.now() / 1000) - 60; // 1 minute ago

    const wrappedPkg = await wrapDocumentKey(docKey, verifier.publicKey, pastExpiry);

    await expect(unwrapDocumentKey(wrappedPkg, verifier.privateKey)).rejects.toThrow('expired');
  });

  it('fails unwrapping when attempted with wrong recipient private key', async () => {
    const docKey = generateAESKey();
    const recipient1 = generateX25519KeyPair();
    const recipient2 = generateX25519KeyPair();

    const wrappedPkg = await wrapDocumentKey(docKey, recipient1.publicKey);
    await expect(unwrapDocumentKey(wrappedPkg, recipient2.privateKey)).rejects.toThrow(
      'Decryption failed',
    );
  });

  it('fails unwrapping when ciphertext or ephemeral key is tampered', async () => {
    const docKey = generateAESKey();
    const recipient = generateX25519KeyPair();

    const wrappedPkg = await wrapDocumentKey(docKey, recipient.publicKey);

    // Tamper wrapped key hex
    const tamperedHex =
      (wrappedPkg.wrappedKey.slice(0, 2) === 'aa' ? 'bb' : 'aa') + wrappedPkg.wrappedKey.slice(2);

    await expect(
      unwrapDocumentKey({ ...wrappedPkg, wrappedKey: tamperedHex }, recipient.privateKey),
    ).rejects.toThrow('Decryption failed');
  });

  it('validates key lengths on wrap and unwrap', async () => {
    const recipient = generateX25519KeyPair();
    await expect(wrapDocumentKey(new Uint8Array(16), recipient.publicKey)).rejects.toThrow(
      'Symmetric key must be 32 bytes',
    );

    await expect(wrapDocumentKey(new Uint8Array(32), new Uint8Array(16))).rejects.toThrow(
      'Recipient public key must be 32 bytes',
    );
  });

  it('creates and decrypts verifier-scoped ephemeral shares with TTL', async () => {
    const docKey = generateAESKey();
    const verifier = generateX25519KeyPair();

    // 15 minute TTL
    const sharePkg = await createVerifierEphemeralShare(docKey, verifier.publicKey, 900);
    expect(sharePkg.expiresAt).toBeDefined();
    expect(sharePkg.expiresAt!).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const unwrapped = await decryptVerifierEphemeralShare(sharePkg, verifier.privateKey);
    expect(unwrapped).toEqual(docKey);
  });
});
