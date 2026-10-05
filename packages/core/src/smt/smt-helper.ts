import { newMemEmptyTrie, SMT } from 'circomlibjs';
import { fieldToHex } from '../crypto/fields.js';

export interface SMTMembershipProof {
  root: bigint;
  key: bigint;
  value: bigint;
  siblings: bigint[];
}

export interface SMTNonMembershipProof {
  root: bigint;
  key: bigint;
  value: bigint; // 0n for non-membership
  siblings: bigint[];
  oldKey: bigint;
  oldValue: bigint;
  isOld0: boolean;
}

export class SparseMerkleTree {
  private trie: SMT;

  constructor(trie: SMT) {
    this.trie = trie;
  }

  /**
   * @notice Retrieves the current root of the SMT as a BN254 scalar field element.
   */
  getRoot(): bigint {
    return this.trie.F.toObject(this.trie.root);
  }

  /**
   * @notice Retrieves the current root as a 0x-prefixed 32-byte hex string.
   */
  getRootHex(): string {
    return fieldToHex(this.getRoot());
  }

  /**
   * @notice Inserts a key-value pair into the Sparse Merkle Tree.
   * @param key The key field element (e.g. credentialId).
   * @param value The value field element (e.g. revocation timestamp or 1n).
   */
  async insert(key: bigint, value: bigint): Promise<void> {
    await this.trie.insert(key, value);
  }

  /**
   * @notice Updates an existing key with a new value.
   */
  async update(key: bigint, value: bigint): Promise<void> {
    await this.trie.update(key, value);
  }

  /**
   * @notice Deletes a key from the Sparse Merkle Tree.
   */
  async delete(key: bigint): Promise<void> {
    await this.trie.delete(key);
  }

  /**
   * @notice Checks whether a key is present in the SMT.
   */
  async has(key: bigint): Promise<boolean> {
    const res = await this.trie.find(key);
    return res.found;
  }

  /**
   * @notice Generates a cryptographic membership proof for an existing key.
   * @param key The key being queried.
   * @param nLevels Optional circuit level depth to pad siblings with 0n.
   */
  async getMembershipProof(key: bigint, nLevels?: number): Promise<SMTMembershipProof> {
    const res = await this.trie.find(key);
    if (!res.found || !res.foundValue) {
      throw new Error(`Key ${key.toString()} not found in SMT; cannot generate membership proof.`);
    }

    const value = this.trie.F.toObject(res.foundValue);
    const siblings = res.siblings.map((s) => this.trie.F.toObject(s));

    if (nLevels !== undefined) {
      while (siblings.length < nLevels) {
        siblings.push(0n);
      }
    }

    return {
      root: this.getRoot(),
      key,
      value,
      siblings,
    };
  }

  /**
   * @notice Generates a cryptographic non-membership exclusion proof for a non-existent key.
   * @dev This proof matches circomlib's SMTVerifier non-inclusion mode (fnc = 1).
   * @param key The key to prove exclusion for.
   * @param nLevels Optional circuit level depth to pad siblings with 0n.
   */
  async getNonMembershipProof(key: bigint, nLevels?: number): Promise<SMTNonMembershipProof> {
    const res = await this.trie.find(key);
    if (res.found) {
      throw new Error(`Key ${key.toString()} exists in SMT; cannot generate non-membership proof.`);
    }

    const siblings = res.siblings.map((s) => this.trie.F.toObject(s));
    if (nLevels !== undefined) {
      while (siblings.length < nLevels) {
        siblings.push(0n);
      }
    }

    const oldKey = res.notFoundKey ? this.trie.F.toObject(res.notFoundKey) : 0n;
    const oldValue = res.notFoundValue ? this.trie.F.toObject(res.notFoundValue) : 0n;

    return {
      root: this.getRoot(),
      key,
      value: 0n,
      siblings,
      oldKey,
      oldValue,
      isOld0: res.isOld0,
    };
  }
}

/**
 * @notice Creates a new in-memory Sparse Merkle Tree using circomlibjs.
 */
export async function createSparseMerkleTree(): Promise<SparseMerkleTree> {
  const trie = await newMemEmptyTrie();
  return new SparseMerkleTree(trie);
}

/**
 * @notice Assembles a Sparse Merkle Tree containing a list of revoked credential IDs.
 * @param revokedCredentialIds Array of credentialId field elements.
 * @param defaultRevocationValue Default value to assign (defaults to 1n).
 */
export async function buildRevocationTree(
  revokedCredentialIds: bigint[],
  defaultRevocationValue = 1n,
): Promise<SparseMerkleTree> {
  const smt = await createSparseMerkleTree();
  for (const credId of revokedCredentialIds) {
    await smt.insert(credId, defaultRevocationValue);
  }
  return smt;
}
