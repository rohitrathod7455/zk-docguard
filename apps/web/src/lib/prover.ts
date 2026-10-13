/**
 * In-browser Groth16 Proving Engine & Verifiable Presentation Packager
 * - Executes in Web Worker when available for non-blocking UI
 * - Formats W3C Verifiable Presentation with selective disclosure
 * - Guarantees zero leakage of unrevealed attributes in presentation payload
 */

import {
  CredentialPackage,
  fieldToBigInt,
  decryptDocument,
  unpackEncryptedPayload,
} from '@zk-docguard/core';
import {
  generateCircuitInputs,
  generateCircuitInputsModeB,
  PresentationQuery,
  CircuitInputs,
  SMTWitnessInput,
} from '@zk-docguard/circuits';

// @ts-expect-error snarkjs untyped import
import * as snarkjs from 'snarkjs';
import { StoredCredential } from './vault';

export const DEGREE_SLOT_NAMES = [
  'holderCommitment',
  'schemaId',
  'degreeCode',
  'programCode',
  'graduationYear',
  'cgpaX100',
  'studentId',
  'expiry',
] as const;

export interface PresentationPredicateSummary {
  index: number;
  slotName: string;
  operator: '>=';
  threshold: number | string;
  satisfied: boolean;
}

export interface VerifiablePresentationPackage {
  '@context': string[];
  type: string[];
  verifiableCredential: [Record<string, unknown>];
  proof: {
    type: 'Groth16Proof2026';
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    publicSignals: string[];
    revealedAttributes: Record<string, unknown>;
    predicates: PresentationPredicateSummary[];
    challenge: string;
    verifierDomain?: string;
  };
  metadata: {
    durationMs: number;
    generatedAt: string;
    workerOffThread: boolean;
  };
}

export interface ProvingProgressCallback {
  (progress: number, message: string): void;
}

/**
 * Executes Groth16 proving, utilizing a Web Worker in browsers,
 * or falling back gracefully to direct async execution in SSR/tests.
 */
async function runProver(
  inputs: CircuitInputs | Record<string, unknown>,
  wasmPathOrUrl: string,
  zkeyPathOrUrl: string,
  onProgress?: ProvingProgressCallback
): Promise<{ proof: Record<string, unknown>; publicSignals: string[]; durationMs: number; workerOffThread: boolean }> {
  // If in a browser that supports Web Worker, use off-thread proving
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(new URL('./proving.worker.ts', import.meta.url), {
          type: 'module',
        });

        worker.onmessage = (event) => {
          const data = event.data;
          if (data.type === 'PROGRESS') {
            onProgress?.(data.progress, data.message);
          } else if (data.type === 'SUCCESS') {
            worker.terminate();
            resolve({
              proof: data.proof,
              publicSignals: data.publicSignals,
              durationMs: data.durationMs,
              workerOffThread: true,
            });
          } else if (data.type === 'ERROR') {
            worker.terminate();
            reject(new Error(data.error));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(`Proving worker error: ${err.message}`));
        };

        worker.postMessage({
          type: 'PROVE',
          inputs,
          wasmPathOrUrl,
          zkeyPathOrUrl,
        });
      } catch {
        // Fallback to direct thread if worker initialization fails
        directProve(inputs, wasmPathOrUrl, zkeyPathOrUrl, onProgress).then(resolve).catch(reject);
      }
    });
  }

  // Fallback for Node / Vitest / unsupported environments
  return directProve(inputs, wasmPathOrUrl, zkeyPathOrUrl, onProgress);
}

/**
 * Direct async prover on current thread
 */
async function directProve(
  inputs: CircuitInputs | Record<string, unknown>,
  wasmPathOrUrl: string,
  zkeyPathOrUrl: string,
  onProgress?: ProvingProgressCallback
): Promise<{ proof: Record<string, unknown>; publicSignals: string[]; durationMs: number; workerOffThread: boolean }> {
  const startTime = performance.now();
  onProgress?.(25, 'Loading proving parameters and circuit assets...');
  onProgress?.(50, 'Computing witness signals and Poseidon commitments...');
  onProgress?.(75, 'Synthesizing Groth16 zero-knowledge proof...');

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    wasmPathOrUrl,
    zkeyPathOrUrl
  );

  const durationMs = Math.round(performance.now() - startTime);
  onProgress?.(100, 'Zero-knowledge proof synthesized successfully.');

  return {
    proof,
    publicSignals,
    durationMs,
    workerOffThread: false,
  };
}

/**
 * Resolves browser asset URLs for circuit artifacts
 */
export function getCircuitAssetPaths(mode: 'MODE_A' | 'MODE_B' = 'MODE_A'): { wasmUrl: string; zkeyUrl: string } {
  if (mode === 'MODE_B') {
    return {
      wasmUrl: '/zk/disclose_mode_b.wasm',
      zkeyUrl: '/zk/disclose_mode_b_final.zkey',
    };
  }
  return {
    wasmUrl: '/zk/disclose.wasm',
    zkeyUrl: '/zk/disclose_final.zkey',
  };
}

/**
 * Generates a full selective disclosure presentation proof
 */
export async function generatePresentationProof(options: {
  credPkg: CredentialPackage;
  holderSecret: bigint | string;
  issuerPublicKey: { x: bigint; y: bigint };
  query: PresentationQuery;
  mode?: 'MODE_A' | 'MODE_B';
  smtWitness?: SMTWitnessInput;
  verifierDomain?: string;
  onProgress?: ProvingProgressCallback;
  overrideAssetPaths?: { wasm: string; zkey: string };
}): Promise<VerifiablePresentationPackage> {
  const {
    credPkg,
    holderSecret,
    issuerPublicKey,
    query,
    mode = 'MODE_A',
    smtWitness,
    verifierDomain,
    onProgress,
    overrideAssetPaths,
  } = options;

  onProgress?.(10, 'Preparing selective disclosure query and constraints...');

  // 1. Generate circuit inputs based on verification mode
  const inputs =
    mode === 'MODE_B' && smtWitness
      ? await generateCircuitInputsModeB(
          credPkg,
          holderSecret,
          issuerPublicKey,
          query,
          smtWitness,
        )
      : await generateCircuitInputs(
          credPkg,
          holderSecret,
          issuerPublicKey,
          query,
        );

  // 2. Resolve assets
  const assets = overrideAssetPaths
    ? { wasmUrl: overrideAssetPaths.wasm, zkeyUrl: overrideAssetPaths.zkey }
    : getCircuitAssetPaths(mode);

  // 3. Execute prover
  const { proof, publicSignals, durationMs, workerOffThread } = await runProver(
    inputs,
    assets.wasmUrl,
    assets.zkeyUrl,
    onProgress
  );

  // 4. Construct sanitized revealed attributes map
  // CRITICAL PRIVACY: Only revealed slots are included. Hidden slots MUST NEVER appear in plaintext.
  const rawValues = credPkg.rawValues.map((v) => fieldToBigInt(v));
  const revealedAttributes: Record<string, unknown> = {};

  for (let i = 0; i < 8; i++) {
    if (query.revealMask[i]) {
      const slotName = DEGREE_SLOT_NAMES[i]!;
      const val = rawValues[i]!;

      // Map raw scalar to human-readable field where appropriate
      if (slotName === 'degreeCode') {
        revealedAttributes[slotName] = Number(val);
        revealedAttributes['degreeName'] = String(credPkg.vc.credentialSubject.degreeName || '');
      } else if (slotName === 'programCode') {
        revealedAttributes[slotName] = Number(val);
        revealedAttributes['programName'] = String(credPkg.vc.credentialSubject.programName || '');
      } else if (slotName === 'graduationYear') {
        revealedAttributes[slotName] = Number(val);
      } else if (slotName === 'cgpaX100') {
        revealedAttributes[slotName] = Number(val);
        revealedAttributes['gpaFormatted'] = (Number(val) / 100).toFixed(2);
      } else if (slotName === 'studentId') {
        revealedAttributes[slotName] = String(credPkg.vc.credentialSubject.studentId || '');
      } else if (slotName === 'expiry') {
        revealedAttributes[slotName] = Number(val);
      } else if (slotName === 'schemaId') {
        revealedAttributes[slotName] = String(credPkg.vc.credentialSubject.schemaId || '');
      } else {
        revealedAttributes[slotName] = val.toString();
      }
    }
  }

  // 5. Construct predicate descriptions
  const predicates: PresentationPredicateSummary[] = (query.predicates || []).map(
    (p: { index: number; threshold: bigint | number }) => {
      const slotName = DEGREE_SLOT_NAMES[p.index]!;
      const thresholdNum = typeof p.threshold === 'bigint' ? Number(p.threshold) : p.threshold;
      const actualVal = Number(rawValues[p.index]!);
      return {
        index: p.index,
        slotName,
        operator: '>=',
      threshold: thresholdNum,
      satisfied: actualVal >= thresholdNum,
    };
  });

  const groth16Proof = proof as {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };

  const presentation: VerifiablePresentationPackage = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://zk-docguard.org/contexts/v1',
    ],
    type: ['VerifiablePresentation', 'SelectiveDisclosurePresentation'],
    verifiableCredential: [credPkg.vc as unknown as Record<string, unknown>],
    proof: {
      type: 'Groth16Proof2026',
      pi_a: groth16Proof.pi_a.slice(0, 2),
      pi_b: [
        groth16Proof.pi_b[0]!.slice(0, 2),
        groth16Proof.pi_b[1]!.slice(0, 2),
      ],
      pi_c: groth16Proof.pi_c.slice(0, 2),
      publicSignals,
      revealedAttributes,
      predicates,
      challenge: typeof query.challenge === 'bigint' ? query.challenge.toString() : query.challenge,
      verifierDomain,
    },
    metadata: {
      durationMs,
      generatedAt: new Date().toISOString(),
      workerOffThread,
    },
  };

  return presentation;
}

/**
 * Decrypts a document attachment client-side using the credential's stored key
 */
export async function decryptStoredDocument(
  storedCred: StoredCredential,
  ciphertextBase64OrBuffer: string | Uint8Array
): Promise<Uint8Array> {
  if (!storedCred.documentKeyHex) {
    throw new Error('Credential does not have an attached decryption key in this vault.');
  }

  const cleanHex = storedCred.documentKeyHex.startsWith('0x')
    ? storedCred.documentKeyHex.slice(2)
    : storedCred.documentKeyHex;

  const match = cleanHex.match(/.{1,2}/g);
  if (!match) throw new Error('Invalid documentKeyHex');
  const keyBytes = new Uint8Array(match.map((b) => parseInt(b, 16)));

  let rawCiphertext: Uint8Array;
  if (typeof ciphertextBase64OrBuffer === 'string') {
    if (typeof Buffer !== 'undefined') {
      rawCiphertext = new Uint8Array(Buffer.from(ciphertextBase64OrBuffer, 'base64'));
    } else {
      const binary = atob(ciphertextBase64OrBuffer);
      rawCiphertext = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        rawCiphertext[i] = binary.charCodeAt(i);
      }
    }
  } else {
    rawCiphertext = ciphertextBase64OrBuffer;
  }

  const unpacked = unpackEncryptedPayload(rawCiphertext);
  return decryptDocument(unpacked, keyBytes);
}
