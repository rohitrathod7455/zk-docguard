import { buildPoseidon, Poseidon } from 'circomlibjs';
import { toFieldElement } from './fields.js';

let cachedPoseidon: Poseidon | null = null;

/**
 * @notice Initializes and caches the circomlibjs Poseidon hash instance.
 */
export async function getPoseidon(): Promise<Poseidon> {
  if (!cachedPoseidon) {
    cachedPoseidon = await buildPoseidon();
  }
  return cachedPoseidon;
}

/**
 * @notice Computes Poseidon hash over an array of field elements.
 * @param inputs Array of field elements (numbers, bigints, or numeric strings).
 * @returns BigInt field element output.
 */
export async function poseidonHash(inputs: (bigint | number | string)[]): Promise<bigint> {
  const p = await getPoseidon();
  const fieldInputs = inputs.map((x) => toFieldElement(x));
  const raw = p(fieldInputs);
  return p.F.toObject(raw);
}

/**
 * @notice Computes 2-input Poseidon hash Poseidon(a, b).
 */
export async function poseidon2(
  a: bigint | number | string,
  b: bigint | number | string,
): Promise<bigint> {
  return poseidonHash([a, b]);
}

export const poseidonHash2 = poseidon2;

/**
 * @notice Computes salted leaf commitment: leaf_i = Poseidon(value_i, salt_i).
 */
export async function computeLeafCommitment(value: bigint, salt: bigint): Promise<bigint> {
  return poseidon2(value, salt);
}

/**
 * @notice Computes the domain-separated credential identifier:
 *         credentialId = Poseidon(credentialRoot, 1)
 */
export async function computeCredentialId(credentialRoot: bigint): Promise<bigint> {
  return poseidon2(credentialRoot, 1n);
}

/**
 * @notice Computes issuerKeyHash = Poseidon(Ax, Ay).
 */
export async function computeIssuerKeyHash(ax: bigint, ay: bigint): Promise<bigint> {
  return poseidon2(ax, ay);
}
