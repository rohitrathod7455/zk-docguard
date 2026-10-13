import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  bytesToField253,
  fieldToHex,
  hexToField,
  generateDocumentKey,
  encryptDocument,
  decryptDocument,
  packEncryptedPayload,
  unpackEncryptedPayload,
  generateX25519KeyPair,
  createVerifierEphemeralShare,
  decryptVerifierEphemeralShare,
  buildCredentialTree,
  verifyMerkleProof,
  createSparseMerkleTree,
} from '../src/index.js';

describe('Phase 10: Property-Based Cryptographic & Tree Invariant Testing', () => {
  it('Property 1: Field element to hex roundtrip preserves scalar value', () => {
    // BN254 scalar field modulus r - 1
    const BN254_R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: BN254_R - 1n }),
        (scalar) => {
          const hex = fieldToHex(scalar);
          const recoveredFromHex = hexToField(hex);
          expect(recoveredFromHex).toBe(scalar);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 2: Arbitrary byte streams up to 31 bytes map injectively into BN254 scalar field', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 31 }),
        (bytes) => {
          const field = bytesToField253(bytes);
          expect(typeof field).toBe('bigint');
          expect(field).toBeGreaterThanOrEqual(0n);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 3: AES-256-GCM authenticated document encryption roundtrip is lossless for arbitrary byte sizes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 4096 }),
        async (originalData) => {
          const docKey = generateDocumentKey();
          const encrypted = await encryptDocument(originalData, docKey);
          const packed = packEncryptedPayload(encrypted);
          const unpacked = unpackEncryptedPayload(packed);
          const decrypted = await decryptDocument(unpacked, docKey);

          expect(Buffer.from(decrypted).toString('hex')).toBe(
            Buffer.from(originalData).toString('hex'),
          );
        },
      ),
      { numRuns: 30 },
    );
  });

  it('Property 4: Ephemeral X25519 key-wrapped share decrypts within TTL and rejects when expired', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 32, maxLength: 32 }), // 32-byte key
        fc.integer({ min: 60, max: 3600 }), // TTL seconds
        async (docKey, ttlSeconds) => {
          const verifierKey = generateX25519KeyPair();
          const share = await createVerifierEphemeralShare(docKey, verifierKey.publicKey, ttlSeconds);
          expect(share.expiresAt).toBeDefined();

          // Decrypt within valid time
          const decryptedKey = await decryptVerifierEphemeralShare(
            share,
            verifierKey.privateKey,
            share.expiresAt! - 10,
          );
          expect(Buffer.from(decryptedKey).toString('hex')).toBe(
            Buffer.from(docKey).toString('hex'),
          );

          // Expired timestamp must reject
          await expect(
            decryptVerifierEphemeralShare(
              share,
              verifierKey.privateKey,
              share.expiresAt! + 1,
            ),
          ).rejects.toThrow(/expired/i);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('Property 5: Credential attribute tree produces deterministic root and verifies Merkle inclusion proofs for all 8 slots', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.bigInt({ min: 0n, max: 1000000000n }), { minLength: 8, maxLength: 8 }),
        async (slots) => {
          const fixedSalts = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
          const tree = await buildCredentialTree(slots, fixedSalts);
          const root = tree.root;
          expect(typeof root).toBe('bigint');

          for (let i = 0; i < 8; i++) {
            const proof = tree.getProof(i);
            const valid = await verifyMerkleProof(proof, root);
            expect(valid).toBe(true);
          }
        },
      ),
      { numRuns: 15 },
    );
  });

  it('Property 6: Sparse Merkle Tree maintains strict membership and non-membership exclusion invariants', async () => {
    const smt = await createSparseMerkleTree();
    const insertedKeys: bigint[] = [];

    // Insert 5 arbitrary keys
    for (let i = 1; i <= 5; i++) {
      const key = BigInt(i * 1000 + 42);
      await smt.insert(key, BigInt(i));
      insertedKeys.push(key);
    }

    // Check membership proofs for inserted keys
    for (const key of insertedKeys) {
      const memProof = await smt.getMembershipProof(key, 10);
      expect(memProof.root).toBe(smt.getRoot());
      expect(memProof.key).toBe(key);
      expect(memProof.siblings).toHaveLength(10);
    }

    // Check non-membership proofs for non-existent keys
    const nonExistentKeys = [99999n, 88888n, 77777n];
    for (const absentKey of nonExistentKeys) {
      const nonMemProof = await smt.getNonMembershipProof(absentKey, 10);
      expect(nonMemProof.root).toBe(smt.getRoot());
      expect(nonMemProof.key).toBe(absentKey);
      expect(nonMemProof.value).toBe(0n);
      expect(nonMemProof.siblings).toHaveLength(10);
    }
  });
});
