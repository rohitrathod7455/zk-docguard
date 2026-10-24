import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildApp } from '@zk-docguard/api/src/server.js';
import { disconnectPrisma, prisma } from '@zk-docguard/api/src/db/client.js';
import {
  generateDocumentKey,
  encryptDocument,
  packEncryptedPayload,
  deriveBabyJubKeyPair,
  computeIssuerKeyHash,
  fieldToHex,
  issueUniversityDegreeCredential,
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

describe('E2E Phase 8: Verifier Portal & Public Document Verification Flow', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const issuerAddress = '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65';
  const issuerDid = `did:ethr:31337:${issuerAddress}`;
  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const chainId = 31337;

  let issuerKey: Awaited<ReturnType<typeof deriveBabyJubKeyPair>>;
  let holderIdentity: ReturnType<typeof createHolderIdentity>;
  let holderSecretField: bigint;
  let holderCommitment: bigint;

  let credPackage: Awaited<ReturnType<typeof issueUniversityDegreeCredential>>;
  let uploadedCid: string;
  let documentHash: string;

  beforeAll(async () => {
    app = await buildApp();

    // 1. Initialize Issuer & Holder cryptographic identities
    const dummyIssuerSeed = new Uint8Array(32).fill(7);
    issuerKey = await deriveBabyJubKeyPair(dummyIssuerSeed);
    const holderSeed = new Uint8Array(32).fill(42);
    holderIdentity = createHolderIdentity(holderSeed);
    holderSecretField = bytesToField253(holderIdentity.privateKey);
    holderCommitment = await holderIdentity.getHolderCommitment();

    // 2. Prepare sample degree document and client-side encryption
    const docBytes = new TextEncoder().encode(
      JSON.stringify({
        student: 'Alex Vance',
        degree: 'Bachelor of Technology in Computer Science',
        institution: 'Northfield Technological University',
        cgpa: 3.75,
        graduationDate: '2026-06-15',
      }),
    );
    documentHash = '0x' + crypto.createHash('sha256').update(docBytes).digest('hex');
    const docKey = generateDocumentKey();
    const encryptedDoc = await encryptDocument(docBytes, docKey);
    const packedCiphertext = packEncryptedPayload(encryptedDoc);

    // 3. Upload encrypted document to IPFS
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

    // 4. Issue credential package anchored to holder commitment
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

    // 4.5. Ensure issuer exists in database
    const keyHash = await computeIssuerKeyHash(issuerKey.publicKey.x, issuerKey.publicKey.y);
    const issuerKeyHashHex = fieldToHex(keyHash);

    await prisma.issuer.upsert({
      where: { address: issuerAddress },
      update: {
        status: 'Active',
        zkKeyHash: issuerKeyHashHex,
      },
      create: {
        address: issuerAddress,
        did: issuerDid,
        zkKeyHash: issuerKeyHashHex,
        metadataURI: 'ipfs://bafybeiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'Active',
      },
    });

    // 5. Anchor in registry database
    await prisma.credentialRecord.upsert({
      where: { docHash: documentHash },
      update: {
        credentialId: credPackage.vc.credentialStatus.credentialId,
        schemaId: credPackage.vc.credentialSubject.schemaId,
        cid: uploadedCid,
        status: 'Valid',
        expiry: 4102444800n,
        issuerAddress,
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
      create: {
        docHash: documentHash,
        credentialId: credPackage.vc.credentialStatus.credentialId,
        schemaId: credPackage.vc.credentialSubject.schemaId,
        cid: uploadedCid,
        status: 'Valid',
        expiry: 4102444800n,
        issuerAddress,
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
    });
  });

  afterAll(async () => {
    // Cascading cleanup of sessions and credentials
    await prisma.verificationSession.deleteMany({
      where: { domain: { in: ['veritas.corp', 'fast-expire.org', 'strict-issuer.com', 'high-bar.edu'] } },
    });
    await prisma.credentialRecord.deleteMany({
      where: { docHash: documentHash },
    });
    await prisma.issuer.deleteMany({
      where: { address: issuerAddress },
    });
    await app.close();
    await disconnectPrisma();
  });

  it('1. full live verification scenario: request -> scan -> prove -> verified with measured latency', async () => {
    const e2eStartTime = performance.now();

    // STEP A: Verifier creates verification request session
    const createSessionRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Veritas Screening Corporation',
        domain: 'veritas.corp',
        request: {
          revealMask: [false, false, true, false, true, false, false, false], // Reveal DegreeCode (2) and GradYear (4)
          requiredAttributes: [2, 4],
          requiredPredicates: [
            { index: 5, minThreshold: 300 }, // CGPA >= 3.00
            { index: 4, minThreshold: 2020 }, // GradYear >= 2020
          ],
          validityWindowMinutes: 15,
        },
      },
    });

    expect(createSessionRes.statusCode).toBe(201);
    const sessionData = JSON.parse(createSessionRes.body);
    const sessionId = sessionData.sessionId;
    const challenge = sessionData.challenge;
    expect(sessionId).toBeDefined();
    expect(challenge).toBeDefined();
    expect(sessionData.qrPayload).toBeDefined();

    // STEP B: Holder scans QR / fetches session request
    const getSessionRes = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${sessionId}`,
    });
    expect(getSessionRes.statusCode).toBe(200);
    const fetchedSession = JSON.parse(getSessionRes.body);
    expect(fetchedSession.status).toBe('PENDING');
    expect(fetchedSession.verifierName).toBe('Veritas Screening Corporation');

    // STEP C: Holder constructs presentation query and generates Groth16 proof
    const query: PresentationQuery = {
      revealMask: [false, false, true, false, true, false, false, false],
      predicates: [
        { index: 5, threshold: 300 },
        { index: 4, threshold: 2020 },
      ],
      currentTime: Math.floor(Date.now() / 1000),
      challenge: BigInt(challenge),
    };

    const circuitInputs = await generateCircuitInputs(
      credPackage,
      holderSecretField,
      issuerKey.publicKey,
      query,
    );

    // Measure in-browser witness & proof generation time
    const proveStartTime = performance.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath,
    );
    const proveDurationMs = performance.now() - proveStartTime;
    expect(proveDurationMs).toBeGreaterThan(0);

    // STEP D: Holder submits presentation to verifier session endpoint
    const presentationPayload = {
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

    const submitRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/presentation`,
      payload: presentationPayload,
    });

    expect(submitRes.statusCode).toBe(200);
    const submitBody = JSON.parse(submitRes.body);
    expect(submitBody.ok).toBe(true);
    expect(submitBody.receipt).toBeDefined();
    expect(submitBody.receipt.receiptSignature).toBeDefined();

    const e2eTotalDurationMs = performance.now() - e2eStartTime;

    // STEP E: Verifier confirms session state is VERIFIED with result receipt
    const finalSessionRes = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${sessionId}`,
    });
    expect(finalSessionRes.statusCode).toBe(200);
    const finalSession = JSON.parse(finalSessionRes.body);
    expect(finalSession.status).toBe('VERIFIED');
    expect(finalSession.result).toBeDefined();
    expect(finalSession.result.disclosedAttributes[2]).toBe(String(DegreeCode.BTech));
    expect(finalSession.result.disclosedAttributes[4]).toBe('2026');

    // Assert latency thresholds and print measurements
    expect(proveDurationMs).toBeLessThan(15000); // Proving sub-15s
    expect(e2eTotalDurationMs).toBeLessThan(20000); // Full E2E cycle sub-20s

    console.warn(`[Phase 8 E2E Benchmark] Proving Time: ${proveDurationMs.toFixed(1)}ms, Total E2E Cycle: ${e2eTotalDurationMs.toFixed(1)}ms`);
  });

  it('2. negative case: expired session fails presentation with human-readable error', async () => {
    // 1. Verifier creates a session with 1 second expiry
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Fast Expiry Verifier',
        domain: 'fast-expire.org',
        request: {
          validityWindowSeconds: 1, // 1 second validity window
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const { sessionId, challenge } = JSON.parse(createRes.body);

    // 2. Wait 1.2 seconds for session to expire
    await new Promise((r) => setTimeout(r, 1200));

    // 3. Holder attempts to submit proof to expired session
    const query: PresentationQuery = {
      revealMask: [false, false, true, false, false, false, false, false],
      currentTime: Math.floor(Date.now() / 1000),
      challenge: BigInt(challenge),
    };
    const circuitInputs = await generateCircuitInputs(
      credPackage,
      holderSecretField,
      issuerKey.publicKey,
      query,
    );
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath,
    );

    const submitRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/presentation`,
      payload: {
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

    // 4. Must reject with 400 and reasonCode SESSION_EXPIRED
    expect(submitRes.statusCode).toBe(400);
    const errBody = JSON.parse(submitRes.body);
    expect(errBody.reasonCode).toBe('SESSION_EXPIRED');
    expect(errBody.error).toMatch(/expired/i);

    // 5. Verification session status is marked EXPIRED
    const sessionRes = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${sessionId}`,
    });
    expect(JSON.parse(sessionRes.body).status).toBe('EXPIRED');
  });

  it('3. negative case: untrusted issuer rejected with human-readable error', async () => {
    // 1. Verifier specifies only a foreign issuer key hash as trusted
    const foreignKeyHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Strict Issuer Policy Service',
        domain: 'strict-issuer.com',
        request: {
          trustedIssuerKeyHashes: [foreignKeyHash],
        },
      },
    });

    const { sessionId, challenge } = JSON.parse(createRes.body);

    // 2. Holder submits proof issued by local university (different key hash)
    const query: PresentationQuery = {
      revealMask: [false, false, true, false, false, false, false, false],
      currentTime: Math.floor(Date.now() / 1000),
      challenge: BigInt(challenge),
    };
    const circuitInputs = await generateCircuitInputs(
      credPackage,
      holderSecretField,
      issuerKey.publicKey,
      query,
    );
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath,
    );

    const submitRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/presentation`,
      payload: {
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

    // 3. Must reject with 400 and reasonCode UNTRUSTED_ISSUER
    expect(submitRes.statusCode).toBe(400);
    const errBody = JSON.parse(submitRes.body);
    expect(errBody.reasonCode).toBe('UNTRUSTED_ISSUER');
    expect(errBody.error).toMatch(/issuer.*trusted/i);
  });

  it('4. negative case: unmet predicate requirement rejected with human-readable error', async () => {
    // 1. Verifier demands GPA >= 3.90 (390 in hundredths)
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'High Academic Standards Board',
        domain: 'high-bar.edu',
        request: {
          requiredPredicates: [{ index: 5, minThreshold: 390 }], // Demand GPA >= 3.90
        },
      },
    });

    const { sessionId, challenge } = JSON.parse(createRes.body);

    // 2. Holder has GPA 3.75, so holder proves GPA >= 3.00 (300 in hundredths)
    const query: PresentationQuery = {
      revealMask: [false, false, true, false, false, false, false, false],
      predicates: [{ index: 5, threshold: 300 }], // Only satisfies 3.00, not 3.90
      currentTime: Math.floor(Date.now() / 1000),
      challenge: BigInt(challenge),
    };
    const circuitInputs = await generateCircuitInputs(
      credPackage,
      holderSecretField,
      issuerKey.publicKey,
      query,
    );
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath,
    );

    const submitRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/presentation`,
      payload: {
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

    // 3. Must reject with 400 and reasonCode PREDICATE_NOT_SATISFIED
    expect(submitRes.statusCode).toBe(400);
    const errBody = JSON.parse(submitRes.body);
    expect(errBody.reasonCode).toBe('PREDICATE_NOT_SATISFIED');
    expect(errBody.error).toMatch(/predicate.*threshold/i);
  });

  it('5. public document verification: client-side SHA-256 and on-chain registry lookup', async () => {
    // 1. Query registered document hash
    const lookupRes = await app.inject({
      method: 'GET',
      url: `/v1/credentials/by-doc-hash/${documentHash}`,
    });

    expect(lookupRes.statusCode).toBe(200);
    const body = JSON.parse(lookupRes.body);
    const record = body.record;
    expect(record.docHash).toBe(documentHash);
    expect(record.status).toBe('Valid');
    expect(record.cid).toBe(uploadedCid);
    expect(record.credentialId).toBeDefined();

    // 2. Query unknown / tampered document hash
    const fakeHash = '0x9999999999999999999999999999999999999999999999999999999999999999';
    const fakeRes = await app.inject({
      method: 'GET',
      url: `/v1/credentials/by-doc-hash/${fakeHash}`,
    });
    expect(fakeRes.statusCode).toBe(404);
  });

  it('6. verifier history lists past sessions with audit details and status', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/sessions?domain=veritas.corp',
    });

    expect(listRes.statusCode).toBe(200);
    const body = JSON.parse(listRes.body);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.sessions)).toBe(true);

    const verifiedSession = body.sessions.find((s: any) => s.domain === 'veritas.corp');
    expect(verifiedSession).toBeDefined();
    expect(verifiedSession.status).toBe('VERIFIED');
    expect(verifiedSession.verifierName).toBe('Veritas Screening Corporation');
    expect(verifiedSession.result).toBeDefined();
  });
});
