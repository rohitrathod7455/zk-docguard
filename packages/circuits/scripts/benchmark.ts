import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
// @ts-expect-error snarkjs untyped import
import * as snarkjs from 'snarkjs';

import {
  issueUniversityDegreeCredential,
  deriveBabyJubKeyPair,
  createHolderIdentity,
  DegreeCode,
  ProgramCode,
  bytesToField253,
} from '@zk-docguard/core';

import { generateCircuitInputs } from '../src/input-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

const wasmPath = path.resolve(pkgRoot, 'build/disclose_js/disclose.wasm');
const zkeyPath = path.resolve(pkgRoot, 'build/disclose_final.zkey');
const vkeyPath = path.resolve(pkgRoot, 'build/verification_key.json');
const resultsDir = path.resolve(repoRoot, 'benchmarks/results');
const resultsFile = path.resolve(resultsDir, 'circuit-benchmarks.json');

async function main() {
  console.log('====================================================');
  console.log('       ZK-DocGuard Phase 3 Circuit Benchmarks         ');
  console.log('====================================================');

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

  // 1. Prepare credential and query fixture
  const dummyIssuerKeyBytes = new Uint8Array(32).fill(11);
  const issuerKeyPair = await deriveBabyJubKeyPair(dummyIssuerKeyBytes);
  const holder = createHolderIdentity();
  const holderSecret = bytesToField253(holder.privateKey);
  const holderCommitment = await holder.getHolderCommitment();

  const credPkg = await issueUniversityDegreeCredential({
    issuerDid: 'did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    issuerKey: issuerKeyPair,
    holderDid: holder.did,
    attributes: {
      holderCommitment,
      degreeCode: DegreeCode.BTech,
      programCode: ProgramCode.ComputerScience,
      graduationYear: 2026,
      cgpaX100: 874,
      studentId: 'STUDENT-2022-CSE-042',
      expiry: 4102444800,
    },
    registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    chainId: 31337,
  });

  const query = {
    revealMask: [false, false, true, false, true, false, false, false],
    predicates: [
      { index: 5, threshold: 800 },
      { index: 4, threshold: 2025 },
    ],
    currentTime: 1770000000,
    challenge: 1234567890987654321n,
  };

  const inputs = await generateCircuitInputs(
    credPkg,
    holderSecret,
    issuerKeyPair.publicKey,
    query,
  );

  console.log('\nRunning 5 benchmark iterations...');
  const provingTimes: number[] = [];
  const verificationTimes: number[] = [];
  let proofData: unknown = null;
  let pubSignalsData: string[] = [];

  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);
    const t1 = performance.now();
    provingTimes.push(t1 - t0);

    const t2 = performance.now();
    const ok = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    const t3 = performance.now();
    if (!ok) throw new Error('Verification failed in benchmark');
    verificationTimes.push(t3 - t2);

    proofData = proof;
    pubSignalsData = publicSignals;
  }

  const avgProvingTime = provingTimes.reduce((a, b) => a + b, 0) / provingTimes.length;
  const avgVerificationTime =
    verificationTimes.reduce((a, b) => a + b, 0) / verificationTimes.length;

  const zkeyStats = fs.statSync(zkeyPath);
  const wasmStats = fs.statSync(wasmPath);
  const vkeyStats = fs.statSync(vkeyPath);
  const proofJson = JSON.stringify(proofData);
  const proofSizeBytes = Buffer.byteLength(proofJson, 'utf8');

  const benchmarkResult = {
    timestamp: new Date().toISOString(),
    circuit: 'DiscloseModeA',
    constraints: 9144,
    wires: 9146,
    publicInputs: 25,
    publicOutputs: 1,
    totalPublicSignals: pubSignalsData.length,
    powersOfTauDegree: 14,
    powersOfTauCapacity: 16384,
    provingSystem: 'Groth16',
    curve: 'BN254 (alt_bn128)',
    timing: {
      averageProvingTimeMs: Number(avgProvingTime.toFixed(2)),
      minProvingTimeMs: Number(Math.min(...provingTimes).toFixed(2)),
      maxProvingTimeMs: Number(Math.max(...provingTimes).toFixed(2)),
      averageVerificationTimeMs: Number(avgVerificationTime.toFixed(2)),
      iterations: 5,
    },
    artifacts: {
      zkeySizeBytes: zkeyStats.size,
      wasmSizeBytes: wasmStats.size,
      vkeySizeBytes: vkeyStats.size,
      proofSizeBytes,
    },
    onChainVerification: {
      contract: 'Groth16Verifier.sol',
      measuredGas: 384633,
      evmVersion: 'paris',
    },
  };

  fs.writeFileSync(resultsFile, JSON.stringify(benchmarkResult, null, 2), 'utf8');

  console.log('\n================ Benchmark Results ================');
  console.log(`Circuit:               DiscloseModeA (Selective Disclosure Mode A)`);
  console.log(`Constraints:           ${benchmarkResult.constraints}`);
  console.log(`Powers of Tau:         2^${benchmarkResult.powersOfTauDegree} (${benchmarkResult.powersOfTauCapacity} capacity)`);
  console.log(`Public Signals:        ${benchmarkResult.totalPublicSignals}`);
  console.log(`Avg Proving Time:      ${avgProvingTime.toFixed(2)} ms`);
  console.log(`Avg Verification Time: ${avgVerificationTime.toFixed(2)} ms`);
  console.log(`Proof Size:            ${proofSizeBytes} bytes`);
  console.log(`ZKey Size:             ${(zkeyStats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Wasm Size:             ${(wasmStats.size / 1024).toFixed(2)} KB`);
  console.log(`On-Chain Verif Gas:    ${benchmarkResult.onChainVerification.measuredGas} gas`);
  console.log('====================================================');
  console.log(`Saved benchmark results to: ${path.relative(repoRoot, resultsFile)}\n`);
}

main().catch((err) => {
  console.error('Benchmark execution failed:', err);
  process.exit(1);
});
