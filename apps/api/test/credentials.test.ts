import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { sealSession } from '../src/auth/siwe.js';
import { prisma, disconnectPrisma } from '../src/db/client.js';

describe('API Credentials and Verify Routes (/v1/credentials, /v1/verify)', () => {
  let app: FastifyInstance;
  const issuerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
  const docHash = '0xaaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee';
  const credentialId = '0xbbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeee';
  const schemaId = '0xcccc1111222233334444555566667777888899990000aaaabbbbccccddddeeee';
  const txHash = '0xdddd1111222233334444555566667777888899990000aaaabbbbccccddddeeee';
  const cid = 'QmTestCredentialCiphertextCID1234567890';

  const issuerCookie = `zkdg_session=${sealSession({
    address: issuerAddress,
    role: 'issuer',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  })}`;

  const userCookie = `zkdg_session=${sealSession({
    address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    role: 'user',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  })}`;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('anchors a credential record by an authenticated active issuer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/credentials/anchor',
      headers: { cookie: issuerCookie },
      payload: {
        docHash,
        credentialId,
        schemaId,
        cid,
        expiry: '4102444800',
        txHash,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.record.docHash).toBe(docHash);
    expect(body.record.status).toBe('Valid');
  });

  it('blocks non-issuer callers from anchoring credentials (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/credentials/anchor',
      headers: { cookie: userCookie },
      payload: {
        docHash: '0x1234123412341234123412341234123412341234123412341234123412341234',
        credentialId: '0x1234123412341234123412341234123412341234123412341234123412341234',
        schemaId: '0x1234123412341234123412341234123412341234123412341234123412341234',
        cid: 'QmDummy',
        expiry: '4102444800',
        txHash: '0x1234123412341234123412341234123412341234123412341234123412341234',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('retrieves credential record by document hash', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/credentials/by-doc-hash/${docHash}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.record.docHash).toBe(docHash);
    expect(body.record.credentialId).toBe(credentialId);
    expect(body.record.issuer.address).toBe(issuerAddress);
  });

  it('returns 404 for unknown document hash in /v1/credentials/by-doc-hash', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/credentials/by-doc-hash/0x0000000000000000000000000000000000000000000000000000000000000000',
    });

    expect(res.statusCode).toBe(404);
  });

  it('verifies a raw document hash directly via POST /v1/verify/document', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/verify/document',
      payload: { docHash },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('Valid');
    expect(body.docHash).toBe(docHash);
    expect(body.issuer.address).toBe(issuerAddress);
  });

  it('returns status Unknown for unregistered document in /v1/verify/document', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/verify/document',
      payload: {
        docHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('Unknown');
  });

  it('lists credential records with filtering in GET /v1/credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/credentials?issuerAddress=${issuerAddress}&status=Valid`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.records[0].docHash).toBe(docHash);
    expect(body.records[0].status).toBe('Valid');
  });
});

