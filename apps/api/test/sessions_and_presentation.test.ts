import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { prisma, disconnectPrisma } from '../src/db/client.js';

describe('API Verification Sessions and Presentation Verification (/v1/sessions)', () => {
  let app: FastifyInstance;
  const fixturePath = path.resolve(
    process.cwd(),
    '../../packages/contracts/test/fixtures/groth16-proof-fixture.json',
  );

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('creates a new verification session with QR payload and challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'State Licensing Board',
        domain: 'licensing.state.gov',
        request: {
          requiredAttributes: [2, 4], // DegreeCode & GraduationYear
          requiredPredicates: [{ index: 5, minThreshold: 800 }], // CGPA >= 800
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.sessionId).toBeDefined();
    expect(body.challenge).toBeDefined();
    expect(body.qrPayload).toBeDefined();
    expect(body.expiresAt).toBeDefined();

    // Fetch session details via GET /v1/sessions/:id
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${body.sessionId}`,
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.sessionId).toBe(body.sessionId);
    expect(getBody.verifierName).toBe('State Licensing Board');
    expect(getBody.status).toBe('PENDING');
  });

  it('verifies a real Groth16 presentation proof end-to-end and generates a signed receipt', async () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { proof, publicSignals } = fixture;

    // 1. Create session
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Employer Background Check',
        domain: 'verify.company.com',
        request: {
          requiredAttributes: [2, 4],
        },
      },
    });
    const sessionData = JSON.parse(res.body);
    const sessionId = sessionData.sessionId;

    // 2. Set the session challenge and currentTime to match the proof fixture
    // Signal 25 is challenge; Signal 24 is currentTime
    const proofChallenge = publicSignals[25];
    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: { challenge: proofChallenge },
    });

    // 3. Ensure proof currentTime (signal 24) is within ±5 minutes of now
    // For test purposes, set currentTime in publicSignals to current epoch seconds
    const currentEpoch = Math.floor(Date.now() / 1000).toString();
    const signalsForTest = [...publicSignals];
    signalsForTest[24] = currentEpoch;

    // Note: If we alter signal 24, snarkjs groth16.verify will check public inputs.
    // In our test, if signal 24 in fixture was 1770000000 (future),
    // let's temporarily adjust session time check or check with matching tolerance window:
    // Let's test with the real fixture:
    // If the proof's public signal 24 is verified, the server checks |now - signal[24]| <= 300.
    // Let's mock Date.now() during this test block to match the fixture's signal 24!
    const originalNow = Date.now;
    try {
      const fixtureTime = Number(publicSignals[24]);
      Date.now = () => fixtureTime * 1000;

      // 4. Submit presentation proof
      const submitRes = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/presentation`,
        payload: {
          proof,
          publicSignals,
        },
      });

      expect(submitRes.statusCode).toBe(200);
      const submitBody = JSON.parse(submitRes.body);
      expect(submitBody.ok).toBe(true);
      expect(submitBody.receipt).toBeDefined();
      expect(submitBody.receipt.receiptSignature).toBeDefined();
      expect(submitBody.receipt.disclosedAttributes[2]).toBe('1'); // BTech
      expect(submitBody.receipt.disclosedAttributes[4]).toBe('2026'); // GradYear
      expect(submitBody.receipt.satisfiedPredicates.length).toBeGreaterThanOrEqual(1);

      // 5. Verify session state updated in database
      const updatedSession = await prisma.verificationSession.findUnique({
        where: { id: sessionId },
      });
      expect(updatedSession?.status).toBe('VERIFIED');
      expect(updatedSession?.receiptSig).toBe(submitBody.receipt.receiptSignature);
    } finally {
      Date.now = originalNow;
    }
  });

  it('rejects presentation submission if challenge does not match', async () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { proof, publicSignals } = fixture;

    // Create session (challenge won't match fixture challenge)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Another Verifier',
        domain: 'another.com',
        request: {},
      },
    });
    const sessionId = JSON.parse(res.body).sessionId;

    const originalNow = Date.now;
    try {
      const fixtureTime = Number(publicSignals[24]);
      Date.now = () => fixtureTime * 1000;

      const submitRes = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/presentation`,
        payload: {
          proof,
          publicSignals,
        },
      });

      expect(submitRes.statusCode).toBe(400);
      const body = JSON.parse(submitRes.body);
      expect(body.reasonCode).toBe('CHALLENGE_MISMATCH');
    } finally {
      Date.now = originalNow;
    }
  });

  it('rejects presentation if credential has been revoked', async () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { proof, publicSignals } = fixture;
    const credentialId = publicSignals[0];

    // Mark this credentialId as revoked in database
    await prisma.revocationLeaf.upsert({
      where: {
        issuerKeyHash_credentialId: {
          issuerKeyHash: publicSignals[1],
          credentialId,
        },
      },
      update: { revokedAt: new Date() },
      create: {
        issuerKeyHash: publicSignals[1],
        credentialId,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Strict Verifier',
        domain: 'strict.com',
        request: {},
      },
    });
    const sessionId = JSON.parse(res.body).sessionId;

    // Match challenge
    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: { challenge: publicSignals[25] },
    });

    const originalNow = Date.now;
    try {
      const fixtureTime = Number(publicSignals[24]);
      Date.now = () => fixtureTime * 1000;

      const submitRes = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/presentation`,
        payload: {
          proof,
          publicSignals,
        },
      });

      expect(submitRes.statusCode).toBe(400);
      const body = JSON.parse(submitRes.body);
      expect(body.reasonCode).toBe('CREDENTIAL_REVOKED');
    } finally {
      Date.now = originalNow;
      // Clean up test revocation leaf so other tests aren't impacted
      await prisma.revocationLeaf.deleteMany({
        where: { credentialId },
      });
    }
  });

  it('retrieves system metrics via GET /v1/metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.issuers).toBeDefined();
    expect(body.credentials).toBeDefined();
    expect(body.sessions).toBeDefined();
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('rejects presentation if issuerKeyHash is not in trusted issuers list', async () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { proof, publicSignals } = fixture;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Untrusted Test Verifier',
        domain: 'untrusted.com',
        request: {
          trustedIssuerKeyHashes: ['0x1111111111111111111111111111111111111111111111111111111111111111'],
        },
      },
    });
    const sessionId = JSON.parse(res.body).sessionId;

    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: { challenge: publicSignals[25] },
    });

    const originalNow = Date.now;
    try {
      const fixtureTime = Number(publicSignals[24]);
      Date.now = () => fixtureTime * 1000;

      const submitRes = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/presentation`,
        payload: { proof, publicSignals },
      });

      expect(submitRes.statusCode).toBe(400);
      expect(JSON.parse(submitRes.body).reasonCode).toBe('UNTRUSTED_ISSUER');
    } finally {
      Date.now = originalNow;
    }
  });

  it('rejects presentation if required attribute was not disclosed', async () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { proof, publicSignals } = fixture;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Strict Attr Verifier',
        domain: 'attr.com',
        request: {
          // Fixture discloses slots 2 and 4. Request slot 7 (which was NOT disclosed):
          requiredAttributes: [7],
        },
      },
    });
    const sessionId = JSON.parse(res.body).sessionId;

    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: { challenge: publicSignals[25] },
    });

    const originalNow = Date.now;
    try {
      const fixtureTime = Number(publicSignals[24]);
      Date.now = () => fixtureTime * 1000;

      const submitRes = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/presentation`,
        payload: { proof, publicSignals },
      });

      expect(submitRes.statusCode).toBe(400);
      expect(JSON.parse(submitRes.body).reasonCode).toBe('MISSING_REQUIRED_ATTRIBUTE');
    } finally {
      Date.now = originalNow;
    }
  });

  it('rejects presentation if proof currentTime is outside tolerance window', async () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { proof, publicSignals } = fixture;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {
        verifierName: 'Stale Proof Verifier',
        domain: 'stale.com',
        request: {},
      },
    });
    const sessionId = JSON.parse(res.body).sessionId;

    await prisma.verificationSession.update({
      where: { id: sessionId },
      data: { challenge: publicSignals[25] },
    });

    // Don't mock Date.now so current time differs from fixture time (1770000000) by years!
    const submitRes = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/presentation`,
      payload: { proof, publicSignals },
    });

    expect(submitRes.statusCode).toBe(400);
    expect(JSON.parse(submitRes.body).reasonCode).toBe('TIMESTAMP_OUT_OF_BOUNDS');
  });

  it('supports sessionEvents listener subscription and emission', async () => {
    const { sessionEvents } = await import('../src/services/events.js');
    let received: any = null;
    const unsub = sessionEvents.subscribe('test-sess', (d) => {
      received = d;
    });

    sessionEvents.emitSessionUpdate('test-sess', { status: 'VERIFIED' });
    expect(received).toEqual({ status: 'VERIFIED' });
    unsub();
  });
});
