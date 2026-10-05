import { describe, it, expect } from 'vitest';
import { buildCredentialTree, verifyProof, TREE_DEPTH, TREE_LEAVES } from '../src/crypto/tree.js';
import { isFieldElement } from '../src/crypto/fields.js';

describe('Credential Commitment Tree (tree.ts)', () => {
  const sampleValues = [
    1000n, // Slot 0: holderCommitment
    2000n, // Slot 1: schemaId
    1n, // Slot 2: degreeCode
    101n, // Slot 3: programCode
    2026n, // Slot 4: graduationYear
    874n, // Slot 5: cgpaX100
    9999n, // Slot 6: studentIdHash
    0n, // Slot 7: expiry
  ];

  it('rejects values array with incorrect length', async () => {
    await expect(buildCredentialTree([1n, 2n])).rejects.toThrow(
      'Credential tree requires exactly 8 values',
    );
  });

  it('rejects custom salts array with incorrect length', async () => {
    await expect(buildCredentialTree(sampleValues, [1n])).rejects.toThrow(
      'Credential tree requires exactly 8 salts',
    );
  });

  it('builds an 8-leaf depth-3 Merkle tree with valid root and leaf commitments', async () => {
    const tree = await buildCredentialTree(sampleValues);

    expect(tree.depth).toBe(TREE_DEPTH);
    expect(tree.leaves.length).toBe(TREE_LEAVES);
    expect(tree.salts.length).toBe(TREE_LEAVES);
    expect(isFieldElement(tree.root)).toBe(true);

    for (let i = 0; i < TREE_LEAVES; i++) {
      expect(isFieldElement(tree.leaves[i]!)).toBe(true);
      expect(isFieldElement(tree.salts[i]!)).toBe(true);
    }
  });

  it('produces identical root given identical values and custom salts (deterministic)', async () => {
    const fixedSalts = [11n, 22n, 33n, 44n, 55n, 66n, 77n, 88n];
    const tree1 = await buildCredentialTree(sampleValues, fixedSalts);
    const tree2 = await buildCredentialTree(sampleValues, fixedSalts);

    expect(tree1.root).toBe(tree2.root);
    expect(tree1.leaves).toEqual(tree2.leaves);
  });

  it('generates valid Merkle audit proofs for all 8 leaves', async () => {
    const tree = await buildCredentialTree(sampleValues);

    for (let i = 0; i < TREE_LEAVES; i++) {
      const proof = tree.getProof(i);
      expect(proof.leaf).toBe(tree.leaves[i]);
      expect(proof.pathIndices).toBe(i);
      expect(proof.siblings.length).toBe(TREE_DEPTH);

      const isValid = await verifyProof(proof, tree.root);
      expect(isValid).toBe(true);
    }
  });

  it('fails verification if leaf commitment is tampered', async () => {
    const tree = await buildCredentialTree(sampleValues);
    const proof = tree.getProof(3);

    const tamperedProof = { ...proof, leaf: proof.leaf + 1n };
    const isValid = await verifyProof(tamperedProof, tree.root);
    expect(isValid).toBe(false);
  });

  it('fails verification if root is tampered', async () => {
    const tree = await buildCredentialTree(sampleValues);
    const proof = tree.getProof(2);

    const tamperedRoot = tree.root + 1n;
    const isValid = await verifyProof(proof, tamperedRoot);
    expect(isValid).toBe(false);
  });

  it('fails verification if sibling path element is tampered', async () => {
    const tree = await buildCredentialTree(sampleValues);
    const proof = tree.getProof(0);

    const tamperedSiblings = [...proof.siblings];
    tamperedSiblings[1] = tamperedSiblings[1]! + 1n;

    const tamperedProof = { ...proof, siblings: tamperedSiblings };
    const isValid = await verifyProof(tamperedProof, tree.root);
    expect(isValid).toBe(false);
  });

  it('fails verification if pathIndex does not correspond to leaf position', async () => {
    const tree = await buildCredentialTree(sampleValues);
    const proof = tree.getProof(0);

    const tamperedProof = { ...proof, pathIndices: 1 };
    const isValid = await verifyProof(tamperedProof, tree.root);
    expect(isValid).toBe(false);
  });
});
