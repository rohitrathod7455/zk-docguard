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
} from '@zk-docguard/core';

import { generateCircuitInputs } from '../src/input-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

const wasmPath = path.resolve(pkgRoot, 'build/disclose_js/disclose.wasm');
const zkeyPath = path.resolve(pkgRoot, 'build/disclose_final.zkey');
const fixturesDir = path.resolve(repoRoot, 'packages/contracts/test/fixtures');
const fixturePath = path.resolve(fixturesDir, 'groth16-proof-fixture.json');

async function main() {
  console.log('Generating Groth16 on-chain proof fixture...');

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

  const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
    revealMask: [false, false, true, false, true, false, false, false], // reveal Degree & GradYear
    predicates: [{ index: 5, threshold: 800 }], // CGPA >= 800
    currentTime: 2000000000,
    challenge: 98765432123456789n,
  });

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);
  const calldataRaw: string = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [a, b, c, pubSignals] = JSON.parse('[' + calldataRaw + ']');

  const fixture = {
    a,
    b,
    c,
    pubSignals,
    proof,
    publicSignals,
  };

  fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), 'utf8');
  console.log(`✅ Saved proof fixture to ${path.relative(repoRoot, fixturePath)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fixture generation failed:', err);
  process.exit(1);
});
