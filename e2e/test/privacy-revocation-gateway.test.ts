import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildApp } from '@zk-docguard/api/src/server.js';
import { disconnectPrisma, prisma } from '@zk-docguard/api/src/db/client.js';
import { sealSession } from '@zk-docguard/api/src/auth/siwe.js';
import {
  generateDocumentKey,
  encryptDocument,
  packEncryptedPayload,
  deriveBabyJubKeyPair,
  issueUniversityDegreeCredential,
  createHolderIdentity,
  bytesToField253,
  createSparseMerkleTree,
  createVerifierEphemeralShare,
  decryptVerifierEphemeralShare,
  generateX25519KeyPair,
  DegreeCode,
  ProgramCode,
} from '@zk-docguard/core';
import {
  generateCircuitInputsModeB,
  PresentationQuery,
  SMTWitnessInput,
} from '@zk-docguard/circuits';

// @ts-expect-error snarkjs untyped import
import * as snarkjs from 'snarkjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../..');

const wasmPathModeB = path.resolve(
  monorepoRoot,
  'packages/circuits/build/disclose_mode_b_js/disclose_mode_b.wasm',
);
const zkeyPathModeB = path.resolve(
  monorepoRoot,
  'packages/circuits/build/disclose_mode_b_final.zkey',
);

describe('E2E Phase 9: Privacy-Preserving Revocation, Verifier Gateway, and Ephemeral Sharing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const issuerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  const issuerDid = `did:ethr:31337:${issuerAddress}`;
  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 31337;

  let issuerKey: Awaited<ReturnType<typeof deriveBabyJubKeyPair>>;
  let holderIdentity: ReturnType<typeof createHolderIdentity>;
  let holderSecretField: bigint;
  let holderCommitment: bigint;

  let cred1Package: Awaited<ReturnType<typeof issueUniversityDegreeCredential>>;
  let cred2Package: Awaited<ReturnType<typeof issueUniversityDegreeCredential>>;
  let cred1Id: string;
  let cred2Id: string;
  let issuerKeyHash: string;
  let docKey: Uint8Array;
  let uploadedCid: string;
  let issuerCookie: string;

  beforeAll(async () => {
    app = await buildApp();

    issuerCookie = `zkdg_session=${sealSession({
      address: issuerAddress.toLowerCase(),
      role: 'issuer',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
    })}`;

    // 1. Initialize cryptographic identities
    const issuerSeed = new Uint8Array(32).fill(9);
    issuerKey = await deriveBabyJubKeyPair(issuerSeed);
    const holderSeed = new Uint8Array(32).fill(42);
    holderIdentity = createHolderIdentity(holderSeed);
    holderSecretField = bytesToField253(holderIdentity.privateKey);
    holderCommitment = await holderIdentity.getHolderCommitment();

    // 2. Encrypt sample document
    const docBytes = new TextEncoder().encode(
      JSON.stringify({
        student: 'Alex Vance',
        degree: 'Bachelor of Technology in Computer Science',
        institution: 'Northfield Technological University',
        cgpa: 3.85,
        graduationDate: '2026-06-15',
      }),
    );
    docKey = generateDocumentKey();
    const encryptedDoc = await encryptDocument(docBytes, docKey);
    const packedCiphertext = packEncryptedPayload(encryptedDoc);

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
    uploadedCid = JSON.parse(uploadRes.body).cid;

    // 3. Issue Credential 1 (will remain unrevoked)
    cred1Package = await issueUniversityDegreeCredential({
      issuerDid,
      issuerKey,
      holderDid: holderIdentity.did,
      attributes: {
        holderCommitment,
        degreeCode: DegreeCode.BTech,
        programCode: ProgramCode.ComputerScience,
        graduationYear: 2026,
        cgpaX100: 385,
        studentId: 'STUDENT-2022-CSE-001',
        expiry: 4102444800,
      },
      registryAddress,
      chainId,
      ciphertextCid: uploadedCid,
    });
    cred1Id = cred1Package.vc.credentialStatus.credentialId;
    issuerKeyHash = '0x' + issuerKey.keyHash.toString(16).padStart(64, '0');

    // 4. Issue Credential 2 (will be revoked to test tree updates)
    cred2Package = await issueUniversityDegreeCredential({
      issuerDid,
      issuerKey,
      holderDid: holderIdentity.did,
      attributes: {
        holderCommitment,
        degreeCode: DegreeCode.BTech,
        programCode: ProgramCode.ComputerScience,
        graduationYear: 2026,
        cgpaX100: 340,
        studentId: 'STUDENT-2022-CSE-002',
        expiry: 4102444800,
      },
      registryAddress,
      chainId,
      ciphertextCid: uploadedCid,
    });
    cred2Id = cred2Package.vc.credentialStatus.credentialId;

    // 5. Seed issuer profile in DB
    await prisma.issuer.upsert({
      where: { address: issuerAddress.toLowerCase() },
      update: {
        did: issuerDid,
        zkKeyHash: issuerKeyHash,
        status: 'Active',
      },
      create: {
        address: issuerAddress.toLowerCase(),
        did: issuerDid,
        zkKeyHash: issuerKeyHash,
        metadataURI: 'ipfs://QmIssuerProfile',
        status: 'Active',
      },
    });
  }, 60000);

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('1. Generates SMT non-membership exclusion witness from API for unrevoked credential', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${issuerKeyHash}/witness/${cred1Id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.witness).toBeDefined();
    expect(body.witness.siblings).toHaveLength(10);
    expect(body.witness.isOld0).toBe(true);
    expect(body.issuerKeyHash.toLowerCase()).toBe(issuerKeyHash.toLowerCase());
  });

  it('2. Successfully proves Mode B selective disclosure without exposing credentialId', async () => {
    // Verifier creates session requesting Mode B
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Enterprise Employment Verification',
        domain: 'enterprise.verify.org',
        request: {
          mode: 'MODE_B',
          revealMask: [false, false, true, false, true, false, false, false], // reveal degree & year, hide gpa
          requiredAttributes: [2, 4],
          requiredPredicates: [{ index: 5, minThreshold: 300 }], // CGPA >= 3.00
          trustedIssuerKeyHashes: [issuerKeyHash],
        },
      },
    });

    expect(sessionRes.statusCode).toBe(201);
    const session = JSON.parse(sessionRes.body);
    const challenge = BigInt(session.challenge);

    // Fetch SMT exclusion witness for cred1Id
    const witnessRes = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${issuerKeyHash}/witness/${cred1Id}`,
    });
    const { witness } = JSON.parse(witnessRes.body);

    const smtWitnessInput: SMTWitnessInput = {
      root: witness.root,
      siblings: witness.siblings,
      oldKey: witness.oldKey,
      oldValue: witness.oldValue,
      isOld0: witness.isOld0,
    };

    const query: PresentationQuery = {
      revealMask: [false, false, true, false, true, false, false, false],
      predicates: [{ index: 5, threshold: 300n }],
      challenge,
      currentTime: Math.floor(Date.now() / 1000),
    };

    const circuitInputs = await generateCircuitInputsModeB(
      cred1Package,
      holderSecretField,
      issuerKey.publicKey,
      query,
      smtWitnessInput,
    );

    // Generate real Mode B Groth16 proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPathModeB,
      zkeyPathModeB,
    );

    // CRITICAL PRIVACY CHECK: credentialId must NOT be present in publicSignals
    // In Mode B publicSignals:
    // [0] = issuerKeyHash
    // [1..8] = revealMask
    // [9..16] = revealedValues
    // [17..18] = predEnable
    // [19..20] = predIndex
    // [21..22] = predThreshold
    // [23] = currentTime
    // [24] = challenge
    // [25] = revocationRoot
    expect(publicSignals).toHaveLength(26);
    expect(publicSignals).not.toContain(BigInt(cred1Id).toString());

    // Submit presentation to session
    const subRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.sessionId}/presentation`,
      payload: {
        mode: 'MODE_B',
        proof: {
          pi_a: proof.pi_a.slice(0, 2),
          pi_b: [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)],
          pi_c: proof.pi_c.slice(0, 2),
          protocol: 'groth16',
          curve: 'bn128',
        },
        publicSignals,
      },
    });

    expect(subRes.statusCode).toBe(200);
    const subBody = JSON.parse(subRes.body);
    expect(subBody.ok).toBe(true);
    expect(subBody.receipt.credentialId).toBe('ANONYMOUS_IN_CIRCUIT_SMT');
  }, 120000);

  it('3. Negative test: Revoking a credential prevents generating non-membership witness', async () => {
    // Issuer revokes Credential 2
    const revokeRes = await app.inject({
      method: 'POST',
      url: '/v1/revocations',
      headers: { cookie: issuerCookie },
      payload: {
        credentialId: cred2Id,
        issuerKeyHash,
        reasonCode: 'Academic integrity withdrawal',
      },
    });
    expect(revokeRes.statusCode).toBe(201);

    // Attempting to fetch non-membership witness for revoked cred2Id returns HTTP 409
    const witnessRes = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${issuerKeyHash}/witness/${cred2Id}`,
    });
    expect(witnessRes.statusCode).toBe(409);
    const witnessBody = JSON.parse(witnessRes.body);
    expect(witnessBody.error).toMatch(/revoked/i);
  });

  it('4. Non-revoked credential remains provable after other credentials in the tree are revoked', async () => {
    // Fetch updated SMT witness for Credential 1 after tree mutation
    const witnessRes = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${issuerKeyHash}/witness/${cred1Id}`,
    });
    expect(witnessRes.statusCode).toBe(200);
    const { witness } = JSON.parse(witnessRes.body);

    // Create session
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'State Licensing Board',
        domain: 'licensing.gov',
        request: {
          mode: 'MODE_B',
          revealMask: [false, false, true, false, true, false, false, false],
        },
      },
    });
    const session = JSON.parse(sessionRes.body);

    const smtWitnessInput: SMTWitnessInput = {
      root: witness.root,
      siblings: witness.siblings,
      oldKey: witness.oldKey,
      oldValue: witness.oldValue,
      isOld0: witness.isOld0,
    };

    const query: PresentationQuery = {
      revealMask: [false, false, true, false, true, false, false, false],
      challenge: BigInt(session.challenge),
      currentTime: Math.floor(Date.now() / 1000),
    };

    const circuitInputs = await generateCircuitInputsModeB(
      cred1Package,
      holderSecretField,
      issuerKey.publicKey,
      query,
      smtWitnessInput,
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPathModeB,
      zkeyPathModeB,
    );

    const subRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.sessionId}/presentation`,
      payload: {
        mode: 'MODE_B',
        proof: {
          pi_a: proof.pi_a.slice(0, 2),
          pi_b: [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)],
          pi_c: proof.pi_c.slice(0, 2),
        },
        publicSignals,
      },
    });

    expect(subRes.statusCode).toBe(200);
    expect(JSON.parse(subRes.body).ok).toBe(true);
  }, 120000);

  it('5. Negative test: Reject proof with tampered or unregistered SMT root', async () => {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Audit Dept',
        domain: 'audit.gov',
        request: { mode: 'MODE_B' },
      },
    });
    const session = JSON.parse(sessionRes.body);

    const witnessRes = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${issuerKeyHash}/witness/${cred1Id}`,
    });
    const { witness } = JSON.parse(witnessRes.body);

    const smtWitnessInput: SMTWitnessInput = {
      root: witness.root,
      siblings: witness.siblings,
      oldKey: witness.oldKey,
      oldValue: witness.oldValue,
      isOld0: witness.isOld0,
    };

    const query: PresentationQuery = {
      revealMask: [false, false, true, false, true, false, false, false],
      challenge: BigInt(session.challenge),
      currentTime: Math.floor(Date.now() / 1000),
    };

    const circuitInputs = await generateCircuitInputsModeB(
      cred1Package,
      holderSecretField,
      issuerKey.publicKey,
      query,
      smtWitnessInput,
    );

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPathModeB,
      zkeyPathModeB,
    );

    // Tamper with public revocationRoot in publicSignals[25]
    const tamperedSignals = [...publicSignals];
    tamperedSignals[25] = '9999999999999999999999999999999999999999';

    const subRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.sessionId}/presentation`,
      payload: {
        mode: 'MODE_B',
        proof: {
          pi_a: proof.pi_a.slice(0, 2),
          pi_b: [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)],
          pi_c: proof.pi_c.slice(0, 2),
        },
        publicSignals: tamperedSignals,
      },
    });

    expect(subRes.statusCode).toBe(400);
    const body = JSON.parse(subRes.body);
    expect(body.ok).toBe(false);
  }, 120000);

  it('6. Verifier-scoped time-limited document sharing with ephemeral X25519 key wrapping', async () => {
    // Verifier generates ephemeral X25519 key pair
    const verifierKeys = generateX25519KeyPair();
    const verifierEphemeralPriv = verifierKeys.privateKey;
    const verifierEphemeralPub = verifierKeys.publicKey;
    const verifierPubHex = Buffer.from(verifierEphemeralPub).toString('hex');

    // 1. Verifier creates sharing request link with TTL = 600s
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/sharing/links',
      payload: {
        cid: uploadedCid,
        verifierPublicKey: verifierPubHex,
        verifierName: 'Consulate Visa Attestation',
        ttlSeconds: 600,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { linkId } = JSON.parse(createRes.body);

    // 2. Holder re-wraps document key for verifier's ephemeral public key
    const wrappedShare = await createVerifierEphemeralShare(docKey, verifierEphemeralPub, 600);

    // 3. Holder fulfills the link
    const fulfillRes = await app.inject({
      method: 'POST',
      url: `/v1/sharing/links/${linkId}/fulfill`,
      payload: {
        wrappedKey: wrappedShare as unknown as Record<string, unknown>,
      },
    });
    expect(fulfillRes.statusCode).toBe(200);

    // 4. Verifier accesses fulfilled link and retrieves wrapped key
    const accessRes = await app.inject({
      method: 'POST',
      url: `/v1/sharing/links/${linkId}/access`,
    });
    expect(accessRes.statusCode).toBe(200);
    const accessBody = JSON.parse(accessRes.body);
    expect(accessBody.cid).toBe(uploadedCid);

    // 5. Verifier unwraps key and recovers original document key
    const recoveredDocKey = await decryptVerifierEphemeralShare(
      accessBody.wrappedKey,
      verifierEphemeralPriv,
    );
    expect(Buffer.from(recoveredDocKey).toString('hex')).toBe(
      Buffer.from(docKey).toString('hex'),
    );

    // 6. Test expiration rejection
    const futureTimestamp = Math.floor(Date.now() / 1000) + 700;
    await expect(
      decryptVerifierEphemeralShare(
        accessBody.wrappedKey,
        verifierEphemeralPriv,
        futureTimestamp,
      ),
    ).rejects.toThrow(/expired/i);
  });
});
