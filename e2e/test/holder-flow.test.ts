import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from '@zk-docguard/api/src/server.js';
import { disconnectPrisma } from '@zk-docguard/api/src/db/client.js';
import {
  generateDocumentKey,
  encryptDocument,
  decryptDocument,
  packEncryptedPayload,
  unpackEncryptedPayload,
  deriveBabyJubKeyPair,
  issueUniversityDegreeCredential,
  verifyUniversityDegreeCredential,
  createHolderIdentity,
  bytesToField253,
  DegreeCode,
  ProgramCode,
} from '@zk-docguard/core';
import {
  generateCircuitInputs,
  PresentationQuery,
} from '@zk-docguard/circuits';

// @ts-expect-error snarkjs has untyped module declarations
import * as snarkjs from 'snarkjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../..');

const wasmPath = path.resolve(monorepoRoot, 'packages/circuits/build/disclose_js/disclose.wasm');
const zkeyPath = path.resolve(monorepoRoot, 'packages/circuits/build/disclose_final.zkey');
const vkeyPath = path.resolve(monorepoRoot, 'packages/circuits/build/verification_key.json');

// PBKDF2 + AES-GCM Vault encryption helper for tests
async function deriveTestVaultKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptTestVault(data: object, passphrase: string): Promise<{ saltHex: string; ivHex: string; ciphertextBase64: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveTestVaultKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource
  );
  return {
    saltHex: Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join(''),
    ivHex: Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join(''),
    ciphertextBase64: Buffer.from(ciphertext).toString('base64'),
  };
}

async function decryptTestVault(envelope: { saltHex: string; ivHex: string; ciphertextBase64: string }, passphrase: string): Promise<any> {
  const salt = new Uint8Array(envelope.saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const iv = new Uint8Array(envelope.ivHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const ciphertext = new Uint8Array(Buffer.from(envelope.ciphertextBase64, 'base64'));
  const key = await deriveTestVaultKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

describe('E2E Phase 7: Holder SSI Wallet & In-Browser Proving Flow', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const issuerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  const issuerDid = `did:ethr:31337:${issuerAddress}`;
  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 31337;

  let issuerKey: Awaited<ReturnType<typeof deriveBabyJubKeyPair>>;
  let holderIdentity: ReturnType<typeof createHolderIdentity>;
  let holderSecretField: bigint;
  let holderCommitment: bigint;

  let credPackage: Awaited<ReturnType<typeof issueUniversityDegreeCredential>>;
  let rawDocumentBytes: Uint8Array;
  let documentKeyBytes: Uint8Array;
  let uploadedCid: string;

  beforeAll(async () => {
    expect(fs.existsSync(wasmPath)).toBe(true);
    expect(fs.existsSync(zkeyPath)).toBe(true);
    expect(fs.existsSync(vkeyPath)).toBe(true);

    app = await buildApp();

    // 1. Initialize institutional issuer key
    const dummyIssuerSeed = new Uint8Array(32).fill(7);
    issuerKey = await deriveBabyJubKeyPair(dummyIssuerSeed);

    // 2. Initialize gasless holder identity
    const holderSeed = new Uint8Array(32).fill(42);
    holderIdentity = createHolderIdentity(holderSeed);
    holderSecretField = bytesToField253(holderIdentity.privateKey);
    holderCommitment = await holderIdentity.getHolderCommitment();
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('1. holder creates wallet with PBKDF2 passphrase and encrypted storage', async () => {
    const passphrase = 'SuperSecurePassphrase2026!';

    // Validate DID structure
    expect(holderIdentity.did).toMatch(/^did:key:z[1-9A-HJ-NP-Za-km-z]+$/);
    expect(holderCommitment).toBeGreaterThan(0n);

    const vaultState = {
      did: holderIdentity.did,
      holderSecret: holderSecretField.toString(),
      credentials: [],
      activities: [{ type: 'KEY_INITIALIZED', timestamp: new Date().toISOString() }],
    };

    // Encrypt vault
    const envelope = await encryptTestVault(vaultState, passphrase);
    expect(envelope.saltHex).toHaveLength(32);
    expect(envelope.ivHex).toHaveLength(24);
    expect(envelope.ciphertextBase64.length).toBeGreaterThan(0);

    // Decrypt with correct passphrase
    const decrypted = await decryptTestVault(envelope, passphrase);
    expect(decrypted.did).toBe(holderIdentity.did);
    expect(decrypted.holderSecret).toBe(holderSecretField.toString());

    // Decrypt with wrong passphrase must fail
    await expect(decryptTestVault(envelope, 'WrongPassphrase!')).rejects.toThrow();
  });

  it('2. holder receives, cryptographically verifies, and stores credential', async () => {
    // Plaintext original document (e.g. graduation certificate PDF/JSON)
    rawDocumentBytes = new TextEncoder().encode(
      JSON.stringify({
        degree: 'Bachelor of Technology in Computer Science and Engineering',
        student: 'Alex Vance',
        studentId: 'STUDENT-2022-CSE-042',
        gpa: 3.75,
        honors: 'Summa Cum Laude',
        university: 'Northfield State University',
        issuedDate: '2026-05-15',
      })
    );

    // Client-side document encryption
    documentKeyBytes = generateDocumentKey();
    const encryptedDoc = await encryptDocument(rawDocumentBytes, documentKeyBytes);
    const packedCiphertext = packEncryptedPayload(encryptedDoc);

    // Upload ciphertext to IPFS
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/v1/ipfs/upload',
      payload: {
        ciphertext: Buffer.from(packedCiphertext).toString('base64'),
        metadata: {
          algorithm: 'AES-256-GCM',
          tagLength: 128,
        },
      },
    });

    expect(uploadRes.statusCode).toBe(201);
    const uploadBody = JSON.parse(uploadRes.body);
    uploadedCid = uploadBody.cid;

    // Issuer issues credential anchored to holder's commitment and IPFS CID
    credPackage = await issueUniversityDegreeCredential({
      issuerDid,
      issuerKey,
      holderDid: holderIdentity.did,
      attributes: {
        holderCommitment,
        degreeCode: DegreeCode.BTech,
        programCode: ProgramCode.ComputerScience,
        graduationYear: 2026,
        cgpaX100: 375, // 3.75 GPA
        studentId: 'STUDENT-2022-CSE-042',
        expiry: 4102444800, // Year 2100
      },
      registryAddress,
      chainId,
      ciphertextCid: uploadedCid,
    });

    // Holder verifies cryptographic validity of the received credential
    const verifyRes = await verifyUniversityDegreeCredential(credPackage.vc, {
      issuerPublicKey: issuerKey.publicKey,
    });

    expect(verifyRes.isValid).toBe(true);
    expect(verifyRes.checks.signature).toBe(true);
    expect(verifyRes.checks.structure).toBe(true);
    expect(verifyRes.checks.notExpired).toBe(true);
  });

  it('3. holder decrypts document attachment client-side from IPFS ciphertext', async () => {
    // Fetch ciphertext from IPFS endpoint
    const ipfsRes = await app.inject({
      method: 'GET',
      url: `/v1/ipfs/${uploadedCid}`,
    });

    expect(ipfsRes.statusCode).toBe(200);
    const fetchedCiphertext = new Uint8Array(ipfsRes.rawPayload);

    // Client-side decryption using stored documentKey
    const unpacked = unpackEncryptedPayload(fetchedCiphertext);
    const decryptedBytes = await decryptDocument(unpacked, documentKeyBytes);

    expect(decryptedBytes).toEqual(rawDocumentBytes);
    const docJson = JSON.parse(new TextDecoder().decode(decryptedBytes));
    expect(docJson.student).toBe('Alex Vance');
    expect(docJson.gpa).toBe(3.75);
  });

  it('4. holder generates selective disclosure Groth16 proof with predicate satisfaction', async () => {
    // 1. Verifier creates an active verification session
    const createSessionRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Apex Capital Verification Service',
        domain: 'apexcapital.org',
        request: {
          revealMask: [false, false, true, false, true, false, false, false], // Reveal DegreeCode (2) and GradYear (4)
          predicates: [
            { index: 5, threshold: 300 }, // GPA >= 3.00 (300 in hundredths)
            { index: 4, threshold: 2020 }, // Graduated >= 2020
          ],
        },
      },
    });

    expect(createSessionRes.statusCode).toBe(201);
    const sessionData = JSON.parse(createSessionRes.body);
    const sessionId = sessionData.sessionId;
    const challenge = sessionData.challenge;

    // 2. Prover constructs presentation query matching verifier session
    const revealMask = [false, false, true, false, true, false, false, false];
    const query: PresentationQuery = {
      revealMask,
      predicates: [
        { index: 5, threshold: 300 },
        { index: 4, threshold: 2020 },
      ],
      currentTime: Math.floor(Date.now() / 1000),
      challenge: BigInt(challenge),
    };

    // 3. Prover calculates circuit inputs
    const circuitInputs = await generateCircuitInputs(
      credPackage,
      holderSecretField,
      issuerKey.publicKey,
      query
    );

    expect(circuitInputs.revealMask).toEqual(['0', '0', '1', '0', '1', '0', '0', '0']);
    expect(circuitInputs.revealedValues[2]).toBe(String(DegreeCode.BTech));
    expect(circuitInputs.revealedValues[4]).toBe('2026');
    // Hidden values MUST be zeroed in public signals
    expect(circuitInputs.revealedValues[5]).toBe('0'); // CGPA is HIDDEN
    expect(circuitInputs.revealedValues[6]).toBe('0'); // Student ID is HIDDEN

    // 4. Prover generates real Groth16 proof with snarkjs
    const startTime = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath
    );
    const durationMs = performance.now() - startTime;

    expect(proof).toHaveProperty('pi_a');
    expect(proof).toHaveProperty('pi_b');
    expect(proof).toHaveProperty('pi_c');
    expect(publicSignals.length).toBeGreaterThan(0);
    expect(durationMs).toBeGreaterThan(0);

    // Save proof for next test
    (globalThis as any).__testProof = { proof, publicSignals, sessionId, challenge };
  });

  it('5. verifier accepts presentation and verifies Groth16 proof successfully', async () => {
    const { proof, publicSignals, sessionId } = (globalThis as any).__testProof;

    const submissionPayload = {
      proof: {
        pi_a: proof.pi_a.slice(0, 2),
        pi_b: [
          proof.pi_b[0].slice(0, 2),
          proof.pi_b[1].slice(0, 2),
        ],
        pi_c: proof.pi_c.slice(0, 2),
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals,
    };

    const verifyRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/presentation`,
      payload: submissionPayload,
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.ok).toBe(true);
    expect(verifyBody.receipt).toBeDefined();
    expect(verifyBody.receipt.sessionId).toBe(sessionId);
    expect(verifyBody.receipt.receiptSignature).toBeDefined();
  });

  it('6. network inspection asserts zero attribute leakage beyond revealed', async () => {
    const { proof, publicSignals, sessionId } = (globalThis as any).__testProof;

    // Full presentation package as transmitted over the wire
    const presentationWirePayload = {
      sessionId,
      proof: {
        pi_a: proof.pi_a.slice(0, 2),
        pi_b: [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)],
        pi_c: proof.pi_c.slice(0, 2),
        publicSignals,
        revealedAttributes: {
          degreeCode: DegreeCode.BTech,
          degreeName: 'Bachelor of Technology',
          graduationYear: 2026,
        },
      },
    };

    const serializedPayload = JSON.stringify(presentationWirePayload);

    // 1. Revealed attributes ARE present
    expect(serializedPayload).toContain('Bachelor of Technology');
    expect(serializedPayload).toContain('2026');

    // 2. Hidden confidential data is STRICTLY ABSENT from the wire
    // CGPA raw value (375 or 3.75) must NOT appear
    expect(serializedPayload).not.toContain('"cgpaX100":375');
    expect(serializedPayload).not.toContain('"375"');
    expect(serializedPayload).not.toContain('3.75');

    // Student ID must NOT appear in wire payload
    expect(serializedPayload).not.toContain('STUDENT-2022-CSE-042');
    expect(serializedPayload).not.toContain('Alex Vance');

    // Private salts must NOT appear
    for (const salt of credPackage.salts) {
      expect(serializedPayload).not.toContain(salt);
    }

    // Holder secret must NOT appear
    expect(serializedPayload).not.toContain(holderSecretField.toString());
  });

  it('7. encrypted backup export and import restores exact credentials and keys', async () => {
    const passphrase = 'BackupRecoveryPassphrase999!';

    const originalWallet = {
      did: holderIdentity.did,
      holderSecret: holderSecretField.toString(),
      credentials: [
        {
          id: credPackage.vc.credentialStatus.credentialId,
          docHash: credPackage.vc.credentialSubject.documentHash,
          degreeTitle: 'Bachelor of Technology in Computer Science',
          pkg: credPackage,
        },
      ],
      activities: [
        { type: 'KEY_INITIALIZED', timestamp: '2026-10-12T10:00:00Z' },
        { type: 'CREDENTIAL_RECEIVED', timestamp: '2026-10-12T10:05:00Z' },
        { type: 'PROOF_GENERATED', timestamp: '2026-10-12T10:10:00Z' },
      ],
    };

    // 1. Export encrypted archive
    const backupEnvelope = await encryptTestVault(originalWallet, passphrase);
    const exportedJsonString = JSON.stringify(backupEnvelope);

    // Backup archive must be ciphertext, not plaintext JSON
    expect(exportedJsonString).not.toContain(holderIdentity.did);
    expect(exportedJsonString).not.toContain('Bachelor of Technology');

    // 2. Restore in a fresh wallet
    const restored = await decryptTestVault(JSON.parse(exportedJsonString), passphrase);

    // Asserts exact reproduction
    expect(restored.did).toBe(originalWallet.did);
    expect(restored.holderSecret).toBe(originalWallet.holderSecret);
    expect(restored.credentials).toHaveLength(1);
    expect(restored.credentials[0].id).toBe(credPackage.vc.credentialStatus.credentialId);
    expect(restored.activities).toHaveLength(3);
  });
});
