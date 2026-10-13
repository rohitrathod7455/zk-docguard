import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-expect-error snarkjs has untyped module declarations in some environments
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

const wasmPath = path.resolve(pkgRoot, 'build/disclose_mode_b_js/disclose_mode_b.wasm');
const zkeyPath = path.resolve(pkgRoot, 'build/disclose_mode_b_final.zkey');
const vkeyPath = path.resolve(pkgRoot, 'build/verification_key_mode_b.json');

describe('DiscloseModeB (SMT In-Circuit Non-Revocation) Circuit Test Suite', () => {
  let vKey: Record<string, unknown>;
  const dummyIssuerKeyBytes = new Uint8Array(32).fill(7);
  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 31337;

  beforeAll(() => {
    expect(fs.existsSync(wasmPath)).toBe(true);
    expect(fs.existsSync(zkeyPath)).toBe(true);
    expect(fs.existsSync(vkeyPath)).toBe(true);
    vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
  });

  async function createFixtureModeB(options?: {
    isRevoked?: boolean;
    cgpaX100?: number;
  }) {
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
        cgpaX100: options?.cgpaX100 ?? 375, // 3.75 GPA
        studentId: 'STUDENT-2022-CSE-099',
        expiry: 4102444800, // Year 2100
      },
      registryAddress,
      chainId,
    });

    const credentialId = fieldToBigInt(credPkg.vc.credentialStatus.credentialId);

    // Build SMT populated with other revoked credentials
    const smt = await createSparseMerkleTree();
    await smt.insert(999888777n, 1n); // Other revoked credential
    await smt.insert(444555666n, 1n); // Another revoked credential

    if (options?.isRevoked) {
      await smt.insert(credentialId, 1n);
    }

    return {
      issuerKeyPair,
      holderSecret,
      credPkg,
      credentialId,
      smt,
    };
  }

  it('1. positive case: valid Mode B proof proves claims and SMT non-revocation', async () => {
    const { issuerKeyPair, holderSecret, credPkg, credentialId, smt } =
      await createFixtureModeB();

    const nonMemWitness = await smt.getNonMembershipProof(credentialId, 10);

    const circuitInputs = await generateCircuitInputsModeB(
      credPkg,
      holderSecret,
      issuerKeyPair.publicKey,
      {
        revealMask: [false, false, true, true, true, false, false, false], // Reveal Degree, Program, GradYear
        predicates: [{ index: 5, threshold: 300 }], // CGPA >= 3.00
        currentTime: Math.floor(Date.now() / 1000),
        challenge: 9876543210123456789n,
      },
      nonMemWitness,
      10,
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath,
    );

    expect(proof).toBeDefined();
    expect(publicSignals.length).toBe(26);

    // Verify proof against verification key
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    expect(isValid).toBe(true);

    // Verify revocationRoot public signal matches SMT root
    const rootSignal = publicSignals[25]; // Last public signal is revocationRoot
    expect(BigInt(rootSignal)).toBe(smt.getRoot());
  }, 30000);

  it('2. negative case: revoked credential cannot obtain a valid non-membership witness', async () => {
    const { credentialId, smt } = await createFixtureModeB({ isRevoked: true });

    // Calling getNonMembershipProof for a revoked key must reject
    await expect(smt.getNonMembershipProof(credentialId, 10)).rejects.toThrow(
      /exists in SMT/i,
    );
  });

  it('3. negative case: invalid SMT witness fails in-circuit constraints during witness calculation', async () => {
    const { issuerKeyPair, holderSecret, credPkg, credentialId, smt } =
      await createFixtureModeB();

    const nonMemWitness = await smt.getNonMembershipProof(credentialId, 10);

    // Tamper with the oldKey in the non-membership witness
    const tamperedWitness = {
      ...nonMemWitness,
      oldKey: 111111111n,
    };

    const circuitInputs = await generateCircuitInputsModeB(
      credPkg,
      holderSecret,
      issuerKeyPair.publicKey,
      {
        revealMask: [false, false, true, false, false, false, false, false],
        challenge: 123456n,
      },
      tamperedWitness,
      10,
    );

    // Witness calculation must fail due to constraint violation in SMTVerifier
    await expect(
      snarkjs.groth16.fullProve(circuitInputs, wasmPath, zkeyPath),
    ).rejects.toThrow();
  }, 30000);

  it('4. negative case: tampered revocation root rejects proof verification', async () => {
    const { issuerKeyPair, holderSecret, credPkg, credentialId, smt } =
      await createFixtureModeB();

    const nonMemWitness = await smt.getNonMembershipProof(credentialId, 10);

    const circuitInputs = await generateCircuitInputsModeB(
      credPkg,
      holderSecret,
      issuerKeyPair.publicKey,
      {
        revealMask: [false, false, true, false, false, false, false, false],
        challenge: 777888n,
      },
      nonMemWitness,
      10,
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath,
    );

    // Tamper with the public revocationRoot signal (index 25)
    const tamperedSignals = [...publicSignals];
    tamperedSignals[25] = '123456789999999999';

    const isValid = await snarkjs.groth16.verify(vKey, tamperedSignals, proof);
    expect(isValid).toBe(false);
  }, 30000);
});
