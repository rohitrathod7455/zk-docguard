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
  computeIssuerKeyHash,
  fieldToBigInt,
} from '@zk-docguard/core';

import { generateCircuitInputs, CircuitInputs } from '../src/input-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');

const wasmPath = path.resolve(pkgRoot, 'build/disclose_js/disclose.wasm');
const zkeyPath = path.resolve(pkgRoot, 'build/disclose_final.zkey');
const vkeyPath = path.resolve(pkgRoot, 'build/verification_key.json');

describe('DiscloseModeA Circuit Test Suite', () => {
  let vKey: Record<string, unknown>;
  const dummyIssuerKeyBytes = new Uint8Array(32).fill(9);
  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 31337;

  beforeAll(() => {
    expect(fs.existsSync(wasmPath)).toBe(true);
    expect(fs.existsSync(zkeyPath)).toBe(true);
    expect(fs.existsSync(vkeyPath)).toBe(true);
    vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
  });

  async function createFixture(options?: {
    graduationYear?: number;
    cgpaX100?: number;
    expiry?: number;
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
        graduationYear: options?.graduationYear ?? 2026,
        cgpaX100: options?.cgpaX100 ?? 874,
        studentId: 'STUDENT-2022-CSE-042',
        expiry: options?.expiry ?? 4102444800, // Jan 1 2100
      },
      registryAddress,
      chainId,
    });

    return {
      credPkg,
      issuerKeyPair,
      holder,
      holderSecret,
    };
  }

  it('generates and verifies a valid selective disclosure proof (Positive E2E)', async () => {
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture();

    // Verifier query:
    // - Reveal DegreeCode (slot 2) and GraduationYear (slot 4)
    // - Hide HolderCommitment (0), SchemaId (1), ProgramCode (3), CGPA (5), StudentId (6), Expiry (7)
    // - Predicate 1: CGPA (slot 5) >= 800 (8.00 CGPA)
    // - Predicate 2: GraduationYear (slot 4) >= 2025
    const revealMask = [false, false, true, false, true, false, false, false];
    const query = {
      revealMask,
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

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);
    expect(proof).toBeDefined();
    expect(publicSignals.length).toBe(26);

    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    expect(isValid).toBe(true);

    // Verify public signals mapping:
    // publicSignals[0] = credentialId
    // publicSignals[1] = issuerKeyHash
    // publicSignals[2..9] = revealMask[0..7]
    // publicSignals[10..17] = revealedValues[0..7]
    // publicSignals[18..19] = predEnable[0..1]
    // publicSignals[20..21] = predIndex[0..1]
    // publicSignals[22..23] = predThreshold[0..1]
    // publicSignals[24] = currentTime
    // publicSignals[25] = challenge

    const expectedIssuerKeyHash = await computeIssuerKeyHash(
      issuerKeyPair.publicKey.x,
      issuerKeyPair.publicKey.y,
    );
    expect(publicSignals[1]).toBe(expectedIssuerKeyHash.toString());

    // Slot 2 revealed DegreeCode = 1 (BTech)
    expect(publicSignals[2 + 2]).toBe('1'); // revealMask[2] == 1
    expect(publicSignals[10 + 2]).toBe('1'); // revealedValues[2] == 1

    // Slot 4 revealed GraduationYear = 2026
    expect(publicSignals[2 + 4]).toBe('1'); // revealMask[4] == 1
    expect(publicSignals[10 + 4]).toBe('2026'); // revealedValues[4] == 2026

    // Slot 5 hidden CGPA: revealMask[5] == 0, revealedValues[5] == 0
    expect(publicSignals[2 + 5]).toBe('0');
    expect(publicSignals[10 + 5]).toBe('0');

    // Predicates checked
    expect(publicSignals[18]).toBe('1'); // predEnable[0]
    expect(publicSignals[20]).toBe('5'); // predIndex[0]
    expect(publicSignals[22]).toBe('800'); // predThreshold[0]

    expect(publicSignals[19]).toBe('1'); // predEnable[1]
    expect(publicSignals[21]).toBe('4'); // predIndex[1]
    expect(publicSignals[23]).toBe('2025'); // predThreshold[1]

    expect(publicSignals[24]).toBe('1770000000'); // currentTime
    expect(publicSignals[25]).toBe(query.challenge.toString()); // challenge
  }, 60000);

  it('fails if an attribute is tampered with', async () => {
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture();

    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false],
      challenge: 42n,
    });

    // Tamper with values[4] (graduation year changed from 2026 to 2024)
    inputs.values[4] = '2024';

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails if issuer public key does not match issuerKeyHash', async () => {
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture();

    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false],
      challenge: 42n,
    });

    // Alter public input issuerKeyHash
    inputs.issuerKeyHash = '9999999999999999999';

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails if signature is forged or corrupted', async () => {
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture();

    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false],
      challenge: 42n,
    });

    // Corrupt signature S scalar
    inputs.S = (BigInt(inputs.S) + 1n).toString();

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails if credential has expired (values[7] < currentTime)', async () => {
    const expiredTimestamp = 1600000000; // Past date (Sept 2020)
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture({
      expiry: expiredTimestamp,
    });

    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false],
      currentTime: 1700000000, // 2023 > 2020 -> EXPIRED
      challenge: 42n,
    });

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails if a predicate threshold is not satisfied', async () => {
    // Student has CGPA = 8.74 (874)
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture({ cgpaX100: 874 });

    // Verifier demands CGPA >= 900 (9.00 CGPA)
    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false],
      predicates: [{ index: 5, threshold: 900 }],
      challenge: 42n,
    });

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails if revealMask reveals an attribute with wrong value', async () => {
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture();

    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, true, false, false, false, false, false], // Reveal degreeCode
      challenge: 42n,
    });

    // DegreeCode is 1 (BTech), but prover submits revealedValues[2] = 2 (MTech)
    inputs.revealedValues[2] = '2';

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails if revealMask is 0 but revealedValues is non-zero (hidden leakage attempt)', async () => {
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture();

    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false], // All hidden
      challenge: 42n,
    });

    // Attempt to inject value in hidden slot 5
    inputs.revealedValues[5] = '874';

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails if prover supplies wrong holderSecret', async () => {
    const { credPkg, issuerKeyPair } = await createFixture();

    const wrongHolderSecret = 9876543210123456789n;

    const inputs = await generateCircuitInputs(credPkg, wrongHolderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false],
      challenge: 42n,
    });

    await expect(snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)).rejects.toThrow();
  }, 60000);

  it('fails verification if challenge is modified after proving', async () => {
    const { credPkg, issuerKeyPair, holderSecret } = await createFixture();

    const inputs = await generateCircuitInputs(credPkg, holderSecret, issuerKeyPair.publicKey, {
      revealMask: [false, false, false, false, false, false, false, false],
      challenge: 11111111n,
    });

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);

    // Tamper with public challenge signal (signal index 25)
    const tamperedSignals = [...publicSignals];
    tamperedSignals[25] = '22222222';

    const isValid = await snarkjs.groth16.verify(vKey, tamperedSignals, proof);
    expect(isValid).toBe(false);
  }, 60000);
});
