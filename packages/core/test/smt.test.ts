import { describe, it, expect } from 'vitest';
import { createSparseMerkleTree, buildRevocationTree } from '../src/smt/smt-helper.js';
import { isFieldElement } from '../src/crypto/fields.js';

describe('Sparse Merkle Tree Revocation Helper (smt-helper.ts)', () => {
  it('creates an empty SMT with valid root', async () => {
    const smt = await createSparseMerkleTree();
    const root = smt.getRoot();
    expect(isFieldElement(root)).toBe(true);

    const rootHex = smt.getRootHex();
    expect(rootHex.startsWith('0x')).toBe(true);
    expect(rootHex.length).toBe(66);
  });

  it('inserts and verifies presence of keys', async () => {
    const smt = await createSparseMerkleTree();
    const credId = 123456789n;

    expect(await smt.has(credId)).toBe(false);

    await smt.insert(credId, 1n);
    expect(await smt.has(credId)).toBe(true);
  });

  it('generates cryptographic membership proof for existing key', async () => {
    const smt = await createSparseMerkleTree();
    const key = 100n;
    const value = 999n;

    await smt.insert(key, value);

    const proof = await smt.getMembershipProof(key, 10);
    expect(proof.root).toBe(smt.getRoot());
    expect(proof.key).toBe(key);
    expect(proof.value).toBe(value);
    expect(proof.siblings.length).toBe(10); // Padded to nLevels = 10
  });

  it('throws when requesting membership proof for absent key', async () => {
    const smt = await createSparseMerkleTree();
    await expect(smt.getMembershipProof(9999n)).rejects.toThrow('not found in SMT');
  });

  it('generates cryptographic non-membership exclusion proof for non-existent key', async () => {
    const smt = await createSparseMerkleTree();
    await smt.insert(100n, 1n);

    // Query non-existent key 200n
    const proof = await smt.getNonMembershipProof(200n, 10);
    expect(proof.root).toBe(smt.getRoot());
    expect(proof.key).toBe(200n);
    expect(proof.value).toBe(0n);
    expect(proof.siblings.length).toBe(10);
    expect(typeof proof.isOld0).toBe('boolean');
    expect(isFieldElement(proof.oldKey)).toBe(true);
    expect(isFieldElement(proof.oldValue)).toBe(true);
  });

  it('throws when requesting non-membership proof for an existing key', async () => {
    const smt = await createSparseMerkleTree();
    await smt.insert(500n, 1n);
    await expect(smt.getNonMembershipProof(500n)).rejects.toThrow('exists in SMT');
  });

  it('updates and deletes keys in the SMT', async () => {
    const smt = await createSparseMerkleTree();
    await smt.insert(10n, 100n);
    const rootBefore = smt.getRoot();

    await smt.update(10n, 200n);
    const rootUpdated = smt.getRoot();
    expect(rootUpdated).not.toBe(rootBefore);

    const proof = await smt.getMembershipProof(10n);
    expect(proof.value).toBe(200n);

    await smt.delete(10n);
    expect(await smt.has(10n)).toBe(false);
  });

  it('builds a batch revocation tree from revoked credential IDs', async () => {
    const revoked = [101n, 202n, 303n];
    const smt = await buildRevocationTree(revoked);

    for (const id of revoked) {
      expect(await smt.has(id)).toBe(true);
      const proof = await smt.getMembershipProof(id);
      expect(proof.value).toBe(1n);
    }

    // Non-revoked credential
    const nonRevokedId = 999n;
    expect(await smt.has(nonRevokedId)).toBe(false);
    const nonMembership = await smt.getNonMembershipProof(nonRevokedId, 10);
    expect(nonMembership.key).toBe(nonRevokedId);
    expect(nonMembership.value).toBe(0n);
  });
});
