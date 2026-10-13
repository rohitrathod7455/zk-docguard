import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-expect-error snarkjs untyped import
import * as snarkjs from 'snarkjs';

import {
  issueUniversityDegreeCredential,
  deriveBabyJubKeyPair,
  createHolderIdentity,
  DegreeCode,
  ProgramCode,
  bytesToField253,
  createSparseMerkleTree,
  fieldToBigInt,
} from '@zk-docguard/core';

import { generateCircuitInputsModeB } from '../src/input-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

const wasmPath = path.resolve(pkgRoot, 'build/disclose_mode_b_js/disclose_mode_b.wasm');
const zkeyPath = path.resolve(pkgRoot, 'build/disclose_mode_b_final.zkey');
const fixturesDir = path.resolve(repoRoot, 'packages/contracts/test/fixtures');
const fixturePath = path.resolve(fixturesDir, 'groth16-proof-fixture-mode-b.json');

async function main() {
  console.log('Generating Mode B Groth16 on-chain proof fixture...');

  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const dummyIssuerKeyBytes = new Uint8Array(32).fill(11);
  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 31337;

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
    registryAddress,
    chainId,
  });

  const credentialId = fieldToBigInt(credPkg.vc.credentialStatus.credentialId);

  // Build SMT with other revoked credentials
  const smt = await createSparseMerkleTree();
  await smt.insert(111222333n, 1n);
  await smt.insert(555666777n, 1n);

  const nonMemWitness = await smt.getNonMembershipProof(credentialId, 10);

  // Set currentTime to a fixed timestamp suitable for testing
  const fixedCurrentTime = 2000000000;
  const challenge = 12345678901234567890n;

  const inputs = await generateCircuitInputsModeB(
    credPkg,
    holderSecret,
    issuerKeyPair.publicKey,
    {
      revealMask: [false, false, true, true, true, false, false, false],
      predicates: [{ index: 5, threshold: 800 }],
      currentTime: fixedCurrentTime,
      challenge,
    },
    nonMemWitness,
    10,
  );

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);

  // Format into calldata ready for Solidity
  const calldataStr = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const parsedCalldata = JSON.parse(`[${calldataStr}]`);

  const fixture = {
    a: parsedCalldata[0],
    b: parsedCalldata[1],
    c: parsedCalldata[2],
    pubSignals: parsedCalldata[3],
    metadata: {
      generatedAt: new Date().toISOString(),
      currentTime: fixedCurrentTime,
      issuerKeyHash: publicSignals[0],
      revocationRoot: publicSignals[25],
      challenge: challenge.toString(),
      credentialId: credentialId.toString(),
    },
  };

  fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), 'utf8');
  console.log(`Saved Mode B proof fixture to ${fixturePath}`);
}

main().catch((err) => {
  console.error('Failed to generate Mode B fixture:', err);
  process.exit(1);
});
