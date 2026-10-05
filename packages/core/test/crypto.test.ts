import { describe, it, expect } from 'vitest';
import {
  canonicalJson,
  BN254_PRIME,
  MASK_253_BITS,
  isFieldElement,
  toFieldElement,
  fieldToHex,
  hexToField,
  stringToField,
  generateRandomFieldElement,
  generateSalts,
  poseidonHash,
  poseidonHash2,
  computeLeafCommitment,
  computeCredentialId,
  computeIssuerKeyHash,
} from '../src/crypto/index.js';

describe('RFC 8785 Canonical JSON (canonicalJson)', () => {
  it('orders object keys lexicographically', () => {
    const objA = { b: 2, a: 1, c: 3 };
    const objB = { c: 3, a: 1, b: 2 };
    expect(canonicalJson(objA)).toBe('{"a":1,"b":2,"c":3}');
    expect(canonicalJson(objA)).toBe(canonicalJson(objB));
  });

  it('orders nested object keys lexicographically at all depths', () => {
    const nested = {
      z: { y: 2, x: 1 },
      a: { c: [3, 2, 1], b: true },
    };
    expect(canonicalJson(nested)).toBe('{"a":{"b":true,"c":[3,2,1]},"z":{"x":1,"y":2}}');
  });

  it('omits undefined properties in compliance with JSON standard', () => {
    const obj = { a: 1, b: undefined, c: null };
    expect(canonicalJson(obj)).toBe('{"a":1,"c":null}');
  });

  it('preserves array element order without sorting', () => {
    const arr = [3, 1, 2];
    expect(canonicalJson(arr)).toBe('[3,1,2]');
  });

  it('handles primitive values in canonicalJson', () => {
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson(123)).toBe('123');
    expect(canonicalJson(true)).toBe('true');
  });
});

describe('BN254 Field Arithmetic (fields.ts)', () => {
  it('validates scalar field bounds', () => {
    expect(isFieldElement(0n)).toBe(true);
    expect(isFieldElement(BN254_PRIME - 1n)).toBe(true);
    expect(isFieldElement(BN254_PRIME)).toBe(false);
    expect(isFieldElement(-1n)).toBe(false);
  });

  it('toFieldElement converts numbers, strings, hex strings, and rejects invalid types', () => {
    expect(toFieldElement(0n)).toBe(0n);
    expect(toFieldElement(100)).toBe(100n);
    expect(toFieldElement('12345')).toBe(12345n);
    expect(toFieldElement('0x2a')).toBe(42n);
    expect(toFieldElement('0X2A')).toBe(42n);

    expect(() => toFieldElement(BN254_PRIME)).toThrow('out of bounds');
    expect(() => toFieldElement(-1n)).toThrow('out of bounds');
    expect(() => toFieldElement(-5)).toThrow('Invalid numeric field element');
    expect(() => toFieldElement(1.5)).toThrow('Invalid numeric field element');
    expect(() => toFieldElement(true as unknown as number)).toThrow(
      'Unsupported field element input type',
    );
  });

  it('fieldToHex throws on invalid field element', () => {
    expect(() => fieldToHex(BN254_PRIME)).toThrow('Invalid field element');
  });

  it('fieldToHex pads to exactly 32 bytes (64 hex characters + 0x)', () => {
    const hex0 = fieldToHex(0n);
    expect(hex0).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
    expect(hex0.length).toBe(66);

    const hex1 = fieldToHex(1n);
    expect(hex1).toBe('0x0000000000000000000000000000000000000000000000000000000000000001');

    expect(hexToField(hex0)).toBe(0n);
    expect(hexToField(hex1)).toBe(1n);
  });

  it('stringToField produces deterministic 253-bit field elements strictly less than BN254_PRIME', () => {
    const input = 'University Degree Verification Schema v1';
    const field1 = stringToField(input);
    const field2 = stringToField(input);

    expect(field1).toBe(field2);
    expect(field1 < BN254_PRIME).toBe(true);
    expect(field1 <= MASK_253_BITS).toBe(true);
  });

  it('generateRandomFieldElement generates valid non-negative field elements', () => {
    for (let i = 0; i < 10; i++) {
      const elem = generateRandomFieldElement();
      expect(isFieldElement(elem)).toBe(true);
      expect(elem >= 0n).toBe(true);
      expect(elem < BN254_PRIME).toBe(true);
    }
  });

  it('generateSalts creates 8 cryptographically distinct random field elements', () => {
    const salts = generateSalts(8);
    expect(salts.length).toBe(8);
    const unique = new Set(salts.map((s) => s.toString()));
    expect(unique.size).toBe(8);
    for (const salt of salts) {
      expect(isFieldElement(salt)).toBe(true);
    }
  });
});

describe('Poseidon Hashing (poseidon.ts)', () => {
  it('computes deterministic multi-input Poseidon hash', async () => {
    const h1 = await poseidonHash([1n, 2n, 3n]);
    const h2 = await poseidonHash([1n, 2n, 3n]);
    expect(h1).toBe(h2);
    expect(isFieldElement(h1)).toBe(true);

    const hDiff = await poseidonHash([1n, 2n, 4n]);
    expect(h1).not.toBe(hDiff);
  });

  it('computes 2-input Poseidon hash matching poseidonHash([a, b])', async () => {
    const h2 = await poseidonHash2(100n, 200n);
    const hMulti = await poseidonHash([100n, 200n]);
    expect(h2).toBe(hMulti);
  });

  it('computes leaf commitment: Poseidon(value, salt)', async () => {
    const value = 874n; // CGPA 8.74
    const salt = 123456789n;
    const leaf = await computeLeafCommitment(value, salt);
    const expected = await poseidonHash([value, salt]);
    expect(leaf).toBe(expected);
  });

  it('computes domain-separated credentialId: Poseidon(credentialRoot, 1)', async () => {
    const root = 9876543210n;
    const credId = await computeCredentialId(root);
    const expected = await poseidonHash([root, 1n]);
    expect(credId).toBe(expected);
  });

  it('computes issuer key hash: Poseidon(Ax, Ay)', async () => {
    const Ax = 111111n;
    const Ay = 222222n;
    const keyHash = await computeIssuerKeyHash(Ax, Ay);
    const expected = await poseidonHash([Ax, Ay]);
    expect(keyHash).toBe(expected);
  });
});
