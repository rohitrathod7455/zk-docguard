import { describe, it, expect } from 'vitest';
import {
  deriveBabyJubPrivateKeyFromSignature,
  deriveBabyJubKeyPair,
  signCredentialRoot,
  verifyCredentialSignature,
  WALLET_DERIVATION_MESSAGE,
} from '../src/crypto/eddsa.js';
import { isFieldElement } from '../src/crypto/fields.js';

describe('BabyJubJub EdDSA-Poseidon (eddsa.ts)', () => {
  // Sample 65-byte deterministic Ethereum signature (130 hex chars)
  const dummyEthSig =
    '0x' +
    'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90' +
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' +
    '1b';

  it('rejects invalid signature length for key derivation', () => {
    expect(() => deriveBabyJubPrivateKeyFromSignature('0x1234')).toThrow(
      'Invalid signature length',
    );
  });

  it('deterministically derives a 32-byte private key via HKDF', () => {
    const key1 = deriveBabyJubPrivateKeyFromSignature(dummyEthSig);
    const key2 = deriveBabyJubPrivateKeyFromSignature(dummyEthSig);
    expect(key1).toEqual(key2);
    expect(key1.length).toBe(32);
  });

  it('derives a valid BabyJubJub keypair and public key hash', async () => {
    const privKey = deriveBabyJubPrivateKeyFromSignature(dummyEthSig);
    const keyPair = await deriveBabyJubKeyPair(privKey);

    expect(isFieldElement(keyPair.publicKey.x)).toBe(true);
    expect(isFieldElement(keyPair.publicKey.y)).toBe(true);
    expect(isFieldElement(keyPair.keyHash)).toBe(true);
  });

  it('signs and verifies a credentialRoot successfully (positive roundtrip)', async () => {
    const privKey = deriveBabyJubPrivateKeyFromSignature(dummyEthSig);
    const keyPair = await deriveBabyJubKeyPair(privKey);

    const credentialRoot = 123456789012345678901234567890n;
    const signature = await signCredentialRoot(keyPair.privateKey, credentialRoot);

    expect(isFieldElement(signature.R8x)).toBe(true);
    expect(isFieldElement(signature.R8y)).toBe(true);
    expect(typeof signature.S).toBe('bigint');

    const isValid = await verifyCredentialSignature(credentialRoot, signature, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it('rejects tampered message', async () => {
    const privKey = deriveBabyJubPrivateKeyFromSignature(dummyEthSig);
    const keyPair = await deriveBabyJubKeyPair(privKey);

    const credentialRoot = 123456789012345678901234567890n;
    const signature = await signCredentialRoot(keyPair.privateKey, credentialRoot);

    const tamperedRoot = credentialRoot + 1n;
    const isValid = await verifyCredentialSignature(tamperedRoot, signature, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it('rejects tampered signature components', async () => {
    const privKey = deriveBabyJubPrivateKeyFromSignature(dummyEthSig);
    const keyPair = await deriveBabyJubKeyPair(privKey);

    const credentialRoot = 123456789012345678901234567890n;
    const signature = await signCredentialRoot(keyPair.privateKey, credentialRoot);

    // Tamper S
    const tamperedS = { ...signature, S: signature.S + 1n };
    const isValidS = await verifyCredentialSignature(credentialRoot, tamperedS, keyPair.publicKey);
    expect(isValidS).toBe(false);

    // Tamper R8x
    const tamperedR8x = { ...signature, R8x: signature.R8x + 1n };
    const isValidR8x = await verifyCredentialSignature(
      credentialRoot,
      tamperedR8x,
      keyPair.publicKey,
    );
    expect(isValidR8x).toBe(false);
  });

  it('rejects verification against a different public key', async () => {
    const privKey1 = deriveBabyJubPrivateKeyFromSignature(dummyEthSig);
    const keyPair1 = await deriveBabyJubKeyPair(privKey1);

    const otherEthSig = dummyEthSig.replace('1b', '1c');
    const privKey2 = deriveBabyJubPrivateKeyFromSignature(otherEthSig);
    const keyPair2 = await deriveBabyJubKeyPair(privKey2);

    const credentialRoot = 5555555555n;
    const signature = await signCredentialRoot(keyPair1.privateKey, credentialRoot);

    const isValid = await verifyCredentialSignature(credentialRoot, signature, keyPair2.publicKey);
    expect(isValid).toBe(false);
  });

  it('has consistent derivation message definition', () => {
    expect(WALLET_DERIVATION_MESSAGE).toContain('ZK-DocGuard: Derive Institutional Proving Key');
  });
});
