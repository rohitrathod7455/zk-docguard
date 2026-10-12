import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { sealSession } from '../src/auth/siwe.js';
import { disconnectPrisma } from '../src/db/client.js';

describe('API Issuer and Admin Routes (/v1/issuers, /v1/admin/issuers)', () => {
  let app: FastifyInstance;
  const adminAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
  const testIssuerAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  const testDid = 'did:ethr:0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const testKeyHash = '0x1234567890123456789012345678901234567890123456789012345678901234';

  const adminCookie = `zkdg_session=${sealSession({
    address: adminAddress,
    role: 'admin',
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
    const { prisma } = await import('../src/db/client.js');
    await prisma.issuer.deleteMany({
      where: { address: testIssuerAddress.toLowerCase() },
    });
  });

  afterAll(async () => {
    const { prisma } = await import('../src/db/client.js');
    await prisma.issuer.deleteMany({
      where: { address: testIssuerAddress.toLowerCase() },
    });
    await app.close();
    await disconnectPrisma();
  });

  it('submits a new institutional issuer application', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/issuers/apply',
      payload: {
        address: testIssuerAddress,
        did: testDid,
        zkKeyHash: testKeyHash,
        metadataURI: 'https://example-university.edu/metadata.json',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.issuer.address).toBe(testIssuerAddress.toLowerCase());
    expect(body.issuer.status).toBe('Pending');
  });

  it('rejects duplicate issuer application for the same address', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/issuers/apply',
      payload: {
        address: testIssuerAddress,
        did: testDid,
        zkKeyHash: testKeyHash,
        metadataURI: 'https://example-university.edu/metadata.json',
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('retrieves registered issuer profile by address', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/issuers/${testIssuerAddress}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.issuer.address).toBe(testIssuerAddress.toLowerCase());
    expect(body.issuer.did).toBe(testDid);
  });

  it('returns 404 for unknown issuer address', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/issuers/0x0000000000000000000000000000000000000000',
    });

    expect(res.statusCode).toBe(404);
  });

  it('admin: lists registered issuers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/issuers?status=Pending',
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.issuers)).toBe(true);
    const found = body.issuers.find((i: { address: string }) => i.address === testIssuerAddress.toLowerCase());
    expect(found).toBeDefined();
  });

  it('admin: approves a pending issuer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/issuers/${testIssuerAddress}/approve`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.issuer.status).toBe('Active');
  });

  it('admin: suspends an active issuer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/issuers/${testIssuerAddress}/suspend`,
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.issuer.status).toBe('Suspended');
  });

  it('blocks non-admin users from admin endpoints (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/issuers/${testIssuerAddress}/approve`,
      headers: { cookie: userCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('blocks unauthenticated requests from admin endpoints (401 Unauthorized)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/issuers',
    });

    expect(res.statusCode).toBe(401);
  });
});
