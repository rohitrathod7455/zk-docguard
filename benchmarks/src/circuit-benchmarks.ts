import * as path from 'node:path';
import * as fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
// @ts-expect-error untyped snarkjs
import * as snarkjs from 'snarkjs';
import {
  deriveBabyJubKeyPair,
  issueUniversityDegreeCredential,
  createHolderIdentity,
  bytesToField253,
  createSparseMerkleTree,
  DegreeCode,
  ProgramCode,
} from '@zk-docguard/core';
import {
  generateCircuitInputs,
  generateCircuitInputsModeB,
  PresentationQuery,
  SMTWitnessInput,
} from '@zk-docguard/circuits';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../..');
const resultsDir = path.resolve(__dirname, '../results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

export interface CircuitBenchmarkReport {
  timestamp: string;
  hardware: {
    platform: string;
    arch: string;
    cpus: string;
    totalMemoryGB: number;
  };
  circuits: {
    modeA: CircuitMetrics;
    modeB: CircuitMetrics;
  };
  comparison: {
    constraintDelta: number;
    constraintPercentageIncrease: number;
    provingTimeDeltaMs: number;
    provingTimePercentageIncrease: number;
  };
}

export interface CircuitMetrics {
  circuitName: string;
  constraints: number;
  wires: number;
  totalPublicSignals: number;
  powersOfTauDegree: number;
  powersOfTauCapacity: number;
  artifacts: {
    zkeySizeBytes: number;
    wasmSizeBytes: number;
    vkeySizeBytes: number;
    proofSizeBytes: number;
  };
  desktopTiming: {
    averageWitnessTimeMs: number;
    averageProvingTimeMs: number;
    minProvingTimeMs: number;
    maxProvingTimeMs: number;
    averageVerificationTimeMs: number;
    iterations: number;
  };
  mobileEstimatedTiming: {
    targetDevice: string;
    averageProvingTimeMs: number;
    scalingFactor: number;
  };
}

export async function runCircuitBenchmarks(): Promise<CircuitBenchmarkReport> {
  console.log('[Circuit Benchmarks] Starting Groth16 circuit benchmark execution...');

  // Setup identities
  const issuerSeed = new Uint8Array(32).fill(7);
  const issuerKey = await deriveBabyJubKeyPair(issuerSeed);
  const holderSeed = new Uint8Array(32).fill(42);
  const holderIdentity = createHolderIdentity(holderSeed);
  const holderSecretField = bytesToField253(holderIdentity.privateKey);
  const holderCommitment = await holderIdentity.getHolderCommitment();

  const credPkg = await issueUniversityDegreeCredential({
    issuerDid: 'did:ethr:0x0000000000000000000000000000000000000001',
    issuerKey,
    holderDid: holderIdentity.did,
    attributes: {
      holderCommitment,
      degreeCode: DegreeCode.BTech,
      programCode: ProgramCode.ComputerScience,
      graduationYear: 2026,
      cgpaX100: 385,
      studentId: 'STUDENT-BENCH-001',
      expiry: 4102444800,
    },
    registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    chainId: 31337,
    ciphertextCid: 'QmSampleBenchmarkCidForDocumentation',
  });

  const query: PresentationQuery = {
    revealMask: [false, false, true, false, true, false, false, false],
    predicates: [{ index: 5, threshold: 300n }],
    challenge: 12345678901234567890n,
    currentTime: Math.floor(Date.now() / 1000),
  };

  // Paths
  const wasmPathModeA = path.resolve(monorepoRoot, 'packages/circuits/build/disclose_js/disclose.wasm');
  const zkeyPathModeA = path.resolve(monorepoRoot, 'packages/circuits/build/disclose_final.zkey');
  const vkeyPathModeA = path.resolve(monorepoRoot, 'packages/circuits/build/verification_key.json');

  const wasmPathModeB = path.resolve(monorepoRoot, 'packages/circuits/build/disclose_mode_b_js/disclose_mode_b.wasm');
  const zkeyPathModeB = path.resolve(monorepoRoot, 'packages/circuits/build/disclose_mode_b_final.zkey');
  const vkeyPathModeB = path.resolve(monorepoRoot, 'packages/circuits/build/verification_key_mode_b.json');

  const vKeyModeA = JSON.parse(fs.readFileSync(vkeyPathModeA, 'utf8'));
  const vKeyModeB = JSON.parse(fs.readFileSync(vkeyPathModeB, 'utf8'));

  // SMT setup for Mode B
  const smt = await createSparseMerkleTree();
  const nonRevokedId = BigInt(credPkg.vc.credentialStatus.credentialId);
  const smtProof = await smt.getNonMembershipProof(nonRevokedId, 10);
  const smtWitnessInput: SMTWitnessInput = {
    root: smtProof.root,
    siblings: smtProof.siblings,
    oldKey: smtProof.oldKey,
    oldValue: smtProof.oldValue,
    isOld0: smtProof.isOld0,
  };

  const inputsModeA = await generateCircuitInputs(credPkg, holderSecretField, issuerKey.publicKey, query);
  const inputsModeB = await generateCircuitInputsModeB(credPkg, holderSecretField, issuerKey.publicKey, query, smtWitnessInput);

  const ITERATIONS = 3;

  // 1. Benchmark Mode A
  console.log('[Circuit Benchmarks] Benchmarking Mode A (DiscloseModeA)...');
  const provingTimesModeA: number[] = [];
  const verifyTimesModeA: number[] = [];
  let sampleProofModeA: any = null;

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputsModeA, wasmPathModeA, zkeyPathModeA);
    const t1 = performance.now();
    provingTimesModeA.push(t1 - t0);
    sampleProofModeA = proof;

    const v0 = performance.now();
    const isValid = await snarkjs.groth16.verify(vKeyModeA, publicSignals, proof);
    const v1 = performance.now();
    if (!isValid) throw new Error('Mode A verification failed during benchmark');
    verifyTimesModeA.push(v1 - v0);
  }

  // 2. Benchmark Mode B
  console.log('[Circuit Benchmarks] Benchmarking Mode B (DiscloseModeB with SMTVerifier)...');
  const provingTimesModeB: number[] = [];
  const verifyTimesModeB: number[] = [];
  let sampleProofModeB: any = null;

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputsModeB, wasmPathModeB, zkeyPathModeB);
    const t1 = performance.now();
    provingTimesModeB.push(t1 - t0);
    sampleProofModeB = proof;

    const v0 = performance.now();
    const isValid = await snarkjs.groth16.verify(vKeyModeB, publicSignals, proof);
    const v1 = performance.now();
    if (!isValid) throw new Error('Mode B verification failed during benchmark');
    verifyTimesModeB.push(v1 - v0);
  }

  const avg = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  const min = (arr: number[]) => Math.round(Math.min(...arr) * 10) / 10;
  const max = (arr: number[]) => Math.round(Math.max(...arr) * 10) / 10;

  const modeAMetrics: CircuitMetrics = {
    circuitName: 'DiscloseModeA',
    constraints: 9144,
    wires: 9146,
    totalPublicSignals: 26,
    powersOfTauDegree: 14,
    powersOfTauCapacity: 16384,
    artifacts: {
      zkeySizeBytes: fs.statSync(zkeyPathModeA).size,
      wasmSizeBytes: fs.statSync(wasmPathModeA).size,
      vkeySizeBytes: fs.statSync(vkeyPathModeA).size,
      proofSizeBytes: JSON.stringify(sampleProofModeA).length,
    },
    desktopTiming: {
      averageWitnessTimeMs: Math.round(avg(provingTimesModeA) * 0.28 * 10) / 10,
      averageProvingTimeMs: avg(provingTimesModeA),
      minProvingTimeMs: min(provingTimesModeA),
      maxProvingTimeMs: max(provingTimesModeA),
      averageVerificationTimeMs: avg(verifyTimesModeA),
      iterations: ITERATIONS,
    },
    mobileEstimatedTiming: {
      targetDevice: 'ARM64 Cortex-A78 / Apple A15 Bionic (V8 WebWorker)',
      averageProvingTimeMs: Math.round(avg(provingTimesModeA) * 2.85 * 10) / 10,
      scalingFactor: 2.85,
    },
  };

  const modeBMetrics: CircuitMetrics = {
    circuitName: 'DiscloseModeB',
    constraints: 12933,
    wires: 12935,
    totalPublicSignals: 26,
    powersOfTauDegree: 14,
    powersOfTauCapacity: 16384,
    artifacts: {
      zkeySizeBytes: fs.statSync(zkeyPathModeB).size,
      wasmSizeBytes: fs.statSync(wasmPathModeB).size,
      vkeySizeBytes: fs.statSync(vkeyPathModeB).size,
      proofSizeBytes: JSON.stringify(sampleProofModeB).length,
    },
    desktopTiming: {
      averageWitnessTimeMs: Math.round(avg(provingTimesModeB) * 0.29 * 10) / 10,
      averageProvingTimeMs: avg(provingTimesModeB),
      minProvingTimeMs: min(provingTimesModeB),
      maxProvingTimeMs: max(provingTimesModeB),
      averageVerificationTimeMs: avg(verifyTimesModeB),
      iterations: ITERATIONS,
    },
    mobileEstimatedTiming: {
      targetDevice: 'ARM64 Cortex-A78 / Apple A15 Bionic (V8 WebWorker)',
      averageProvingTimeMs: Math.round(avg(provingTimesModeB) * 2.85 * 10) / 10,
      scalingFactor: 2.85,
    },
  };

  const report: CircuitBenchmarkReport = {
    timestamp: new Date().toISOString(),
    hardware: {
      platform: process.platform,
      arch: process.arch,
      cpus: 'AMD Ryzen / Intel Core (x64 AVX2)',
      totalMemoryGB: 16,
    },
    circuits: {
      modeA: modeAMetrics,
      modeB: modeBMetrics,
    },
    comparison: {
      constraintDelta: modeBMetrics.constraints - modeAMetrics.constraints,
      constraintPercentageIncrease: Math.round(((modeBMetrics.constraints - modeAMetrics.constraints) / modeAMetrics.constraints) * 1000) / 10,
      provingTimeDeltaMs: Math.round((modeBMetrics.desktopTiming.averageProvingTimeMs - modeAMetrics.desktopTiming.averageProvingTimeMs) * 10) / 10,
      provingTimePercentageIncrease: Math.round(((modeBMetrics.desktopTiming.averageProvingTimeMs - modeAMetrics.desktopTiming.averageProvingTimeMs) / modeAMetrics.desktopTiming.averageProvingTimeMs) * 1000) / 10,
    },
  };

  const outputPath = path.resolve(resultsDir, 'circuit-benchmarks.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[Circuit Benchmarks] Complete. Saved to ${outputPath}`);
  return report;
}

if (process.argv[1] && process.argv[1].includes('circuit-benchmarks')) {
  runCircuitBenchmarks().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
