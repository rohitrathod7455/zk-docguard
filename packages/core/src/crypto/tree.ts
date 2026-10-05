import { computeLeafCommitment, poseidon2 } from './poseidon.js';
import { randomFieldElement } from './fields.js';

export const CREDENTIAL_TREE_DEPTH = 3;
export const CREDENTIAL_ATTRIBUTE_COUNT = 8; // 2^3

export const TREE_DEPTH = CREDENTIAL_TREE_DEPTH;
export const TREE_LEAVES = CREDENTIAL_ATTRIBUTE_COUNT;

export interface MerkleAuditProof {
  leaf: bigint;
  siblings: bigint[];
  pathElements: bigint[];
  pathIndices: number;
  pathIndicesArray: number[];
}

export interface CredentialTree {
  values: bigint[];
  salts: bigint[];
  leaves: bigint[];
  layers: bigint[][];
  root: bigint;
  depth: number;
  getMerkleProof(slotIndex: number): MerkleAuditProof;
  getProof(slotIndex: number): MerkleAuditProof;
}

/**
 * @notice Constructs an 8-leaf, depth-3 Poseidon binary Merkle tree over credential attribute slots.
 *         Each leaf is leaf_i = Poseidon(value_i, salt_i).
 * @param values Array of exactly 8 BN254 field elements.
 * @param customSalts Optional array of 8 pre-generated salts; if omitted, fresh random salts are generated.
 * @returns Fully constructed CredentialTree with leaves, intermediate nodes, root, and proof generators.
 */
export async function buildCredentialTree(
  values: bigint[],
  customSalts?: bigint[],
): Promise<CredentialTree> {
  if (values.length !== CREDENTIAL_ATTRIBUTE_COUNT) {
    throw new Error(
      `Credential tree requires exactly ${CREDENTIAL_ATTRIBUTE_COUNT} values, received ${values.length}`,
    );
  }

  const salts = customSalts ?? values.map(() => randomFieldElement());
  if (salts.length !== CREDENTIAL_ATTRIBUTE_COUNT) {
    throw new Error(
      `Credential tree requires exactly ${CREDENTIAL_ATTRIBUTE_COUNT} salts, received ${salts.length}`,
    );
  }

  // Layer 0: Leaves (Poseidon(value_i, salt_i))
  const leaves: bigint[] = [];
  for (let i = 0; i < CREDENTIAL_ATTRIBUTE_COUNT; i++) {
    leaves.push(await computeLeafCommitment(values[i]!, salts[i]!));
  }

  // Layer 1: 4 nodes
  const layer1: bigint[] = [];
  for (let i = 0; i < 4; i++) {
    layer1.push(await poseidon2(leaves[i * 2]!, leaves[i * 2 + 1]!));
  }

  // Layer 2: 2 nodes
  const layer2: bigint[] = [
    await poseidon2(layer1[0]!, layer1[1]!),
    await poseidon2(layer1[2]!, layer1[3]!),
  ];

  // Layer 3: Root
  const root = await poseidon2(layer2[0]!, layer2[1]!);

  const layers = [leaves, layer1, layer2, [root]];

  const getProof = (slotIndex: number): MerkleAuditProof => {
    if (slotIndex < 0 || slotIndex >= CREDENTIAL_ATTRIBUTE_COUNT) {
      throw new Error(`Slot index out of range [0, 7]: ${slotIndex}`);
    }
    const siblings: bigint[] = [];
    const pathIndicesArray: number[] = [];

    let currentIdx = slotIndex;
    for (let layerIdx = 0; layerIdx < CREDENTIAL_TREE_DEPTH; layerIdx++) {
      const isRightNode = currentIdx % 2 === 1;
      const siblingIdx = isRightNode ? currentIdx - 1 : currentIdx + 1;
      siblings.push(layers[layerIdx]![siblingIdx]!);
      pathIndicesArray.push(isRightNode ? 1 : 0);
      currentIdx = Math.floor(currentIdx / 2);
    }

    return {
      leaf: leaves[slotIndex]!,
      siblings,
      pathElements: siblings,
      pathIndices: slotIndex,
      pathIndicesArray,
    };
  };

  return {
    values,
    salts,
    leaves,
    layers,
    root,
    depth: CREDENTIAL_TREE_DEPTH,
    getMerkleProof: getProof,
    getProof,
  };
}

/**
 * @notice Cryptographically verifies a binary Merkle audit path proof up to the expected root.
 * @param proof The MerkleAuditProof.
 * @param root Expected Merkle root field element.
 * @returns True if the path reconstructs root.
 */
export async function verifyProof(
  proof: { leaf: bigint; siblings: bigint[]; pathIndices: number },
  root: bigint,
): Promise<boolean> {
  let current = proof.leaf;
  let idx = proof.pathIndices;

  for (let i = 0; i < proof.siblings.length; i++) {
    const isRightNode = (idx & 1) === 1;
    const sibling = proof.siblings[i]!;

    if (isRightNode) {
      current = await poseidon2(sibling, current);
    } else {
      current = await poseidon2(current, sibling);
    }
    idx = idx >> 1;
  }

  return current === root;
}

export const verifyMerkleProof = verifyProof;
