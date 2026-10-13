import {
  CredentialPackage,
  computeIssuerKeyHash,
  fieldToBigInt,
} from '@zk-docguard/core';

export interface PredicateQuery {
  index: number;
  threshold: bigint | number;
}

export interface PresentationQuery {
  revealMask: boolean[]; // Array of 8 booleans
  predicates?: PredicateQuery[]; // Up to 2 predicates
  currentTime?: number | bigint;
  challenge: bigint | string;
}

export interface CircuitInputs {
  // Private inputs
  values: string[];
  salts: string[];
  holderSecret: string;
  Ax: string;
  Ay: string;
  R8x: string;
  R8y: string;
  S: string;

  // Public inputs
  issuerKeyHash: string;
  revealMask: string[];
  revealedValues: string[];
  predEnable: string[];
  predIndex: string[];
  predThreshold: string[];
  currentTime: string;
  challenge: string;
}

export interface CircuitInputsModeB extends CircuitInputs {
  // Mode B SMT non-membership private inputs
  smtSiblings: string[];
  smtOldKey: string;
  smtOldValue: string;
  smtIsOld0: string;

  // Mode B public input
  revocationRoot: string;
}

export interface SMTWitnessInput {
  root: bigint | string;
  siblings: (bigint | string)[];
  oldKey: bigint | string;
  oldValue: bigint | string;
  isOld0: boolean;
}

/**
 * @notice Generates valid Groth16 circuit inputs for the DiscloseModeA circuit
 *         from an issued CredentialPackage and a verifier's presentation query.
 * @param credPkg Issued CredentialPackage containing VC, raw values, and salts.
 * @param holderSecret Prover's private holder secret (field element).
 * @param issuerPublicKey BabyJubJub public key { x, y } of the issuer.
 * @param query Presentation query specifying disclosed attributes and predicates.
 */
export async function generateCircuitInputs(
  credPkg: CredentialPackage,
  holderSecret: bigint | string,
  issuerPublicKey: { x: bigint; y: bigint },
  query: PresentationQuery,
): Promise<CircuitInputs> {
  const values = credPkg.rawValues.map((v) => fieldToBigInt(v));
  const salts = credPkg.salts.map((s) => fieldToBigInt(s));

  if (values.length !== 8 || salts.length !== 8) {
    throw new Error(`Credential must have exactly 8 attribute values and 8 salts`);
  }

  const holderSecretBI = typeof holderSecret === 'string' ? BigInt(holderSecret) : holderSecret;

  // Extract signature components from VC proof
  const sig = credPkg.vc.proof.signature;
  const R8x = fieldToBigInt(sig.R8x);
  const R8y = fieldToBigInt(sig.R8y);
  const S = BigInt(sig.S);

  const Ax = issuerPublicKey.x;
  const Ay = issuerPublicKey.y;
  const issuerKeyHash = await computeIssuerKeyHash(Ax, Ay);

  // Selective disclosure mask and values
  const mask = query.revealMask;
  if (mask.length !== 8) {
    throw new Error(`revealMask must have exactly 8 elements`);
  }

  const revealMaskSignals: string[] = [];
  const revealedValuesSignals: string[] = [];
  for (let i = 0; i < 8; i++) {
    const isRevealed = Boolean(mask[i]);
    revealMaskSignals.push(isRevealed ? '1' : '0');
    revealedValuesSignals.push(isRevealed ? values[i]!.toString() : '0');
  }

  // Predicates (up to 2)
  const predQueries = query.predicates ?? [];
  if (predQueries.length > 2) {
    throw new Error(`Circuit supports at most 2 inequality predicates`);
  }

  const predEnable: string[] = [];
  const predIndex: string[] = [];
  const predThreshold: string[] = [];

  for (let p = 0; p < 2; p++) {
    if (p < predQueries.length) {
      const pred = predQueries[p]!;
      if (pred.index < 0 || pred.index >= 8) {
        throw new Error(`Predicate slot index out of bounds [0, 7]: ${pred.index}`);
      }
      predEnable.push('1');
      predIndex.push(pred.index.toString());
      predThreshold.push(BigInt(pred.threshold).toString());
    } else {
      predEnable.push('0');
      predIndex.push('0');
      predThreshold.push('0');
    }
  }

  // Expiry & Challenge
  const currentTime =
    query.currentTime !== undefined
      ? BigInt(query.currentTime)
      : BigInt(Math.floor(Date.now() / 1000));

  const challengeBI =
    typeof query.challenge === 'string' ? BigInt(query.challenge) : query.challenge;

  return {
    values: values.map((v) => v.toString()),
    salts: salts.map((s) => s.toString()),
    holderSecret: holderSecretBI.toString(),
    Ax: Ax.toString(),
    Ay: Ay.toString(),
    R8x: R8x.toString(),
    R8y: R8y.toString(),
    S: S.toString(),
    issuerKeyHash: issuerKeyHash.toString(),
    revealMask: revealMaskSignals,
    revealedValues: revealedValuesSignals,
    predEnable,
    predIndex,
    predThreshold,
    currentTime: currentTime.toString(),
    challenge: challengeBI.toString(),
  };
}

/**
 * @notice Generates valid Groth16 circuit inputs for the DiscloseModeB circuit
 *         including SMT non-membership witness and public revocation root.
 * @param credPkg Issued CredentialPackage containing VC, raw values, and salts.
 * @param holderSecret Prover's private holder secret (field element).
 * @param issuerPublicKey BabyJubJub public key { x, y } of the issuer.
 * @param query Presentation query specifying disclosed attributes and predicates.
 * @param smtWitness SMT non-membership exclusion witness for credentialId.
 * @param smtLevels Tree depth (defaults to 10).
 */
export async function generateCircuitInputsModeB(
  credPkg: CredentialPackage,
  holderSecret: bigint | string,
  issuerPublicKey: { x: bigint; y: bigint },
  query: PresentationQuery,
  smtWitness: SMTWitnessInput,
  smtLevels = 10,
): Promise<CircuitInputsModeB> {
  const baseInputs = await generateCircuitInputs(
    credPkg,
    holderSecret,
    issuerPublicKey,
    query,
  );

  const siblings: string[] = [];
  for (let s = 0; s < smtLevels; s++) {
    if (s < smtWitness.siblings.length) {
      siblings.push(BigInt(smtWitness.siblings[s]!).toString());
    } else {
      siblings.push('0');
    }
  }

  return {
    ...baseInputs,
    smtSiblings: siblings,
    smtOldKey: BigInt(smtWitness.oldKey).toString(),
    smtOldValue: BigInt(smtWitness.oldValue).toString(),
    smtIsOld0: smtWitness.isOld0 ? '1' : '0',
    revocationRoot: BigInt(smtWitness.root).toString(),
  };
}

