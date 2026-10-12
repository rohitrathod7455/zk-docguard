import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { prisma, disconnectPrisma } from '../src/db/client.js';
import { sealSession } from '../src/auth/siwe.js';

describe('API Revocation Routes (/v1/revocations)', () => {
  let app: FastifyInstance;
  const issuerAddress = '0x1111111111111111111111111111111111111111';
  const otherAddress = '0x2222222222222222222222222222222222222222';
  let issuerCookie: string;
  let otherCookie: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create session cookies
    const issuerToken = sealSession({
      address: issuerAddress,
      role: 'issuer',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    issuerCookie = `zkdg_session=${issuerToken}`;

    const otherToken = sealSession({
      address: otherAddress,
      role: 'issuer',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    otherCookie = `zkdg_session=${otherToken}`;

    // Seed issuer
    await prisma.issuer.upsert({
      where: { address: issuerAddress },
      update: {},
      create: {
        address: issuerAddress,
        did: `did:ethr:31337:${issuerAddress}`,
        zkKeyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        metadataURI: 'ipfs://QmIssuerMetadata',
        status: 'Active',
        approvedAt: new Date(),
      },
    });

    // Seed a credential for issuer
    await prisma.credentialRecord.upsert({
      where: { credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
      update: {},
      create: {
        docHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        schemaId: '0x1111111111111111111111111111111111111111111111111111111111111111',
        cid: 'QmRevokeTest',
        status: 'Valid',
        issuerAddress: issuerAddress,
        expiry: 4102444800n,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    await disconnectPrisma();
  });

  it('rejects revocation from unauthenticated caller', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/revocations',
      payload: {
        credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        issuerKeyHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects revocation with invalid payload format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/revocations',
      headers: { cookie: issuerCookie },
      payload: {
        credentialId: 'not-hex',
        issuerKeyHash: 'invalid',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects revocation from different issuer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/revocations',
      headers: { cookie: otherCookie },
      payload: {
        credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        issuerKeyHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('records revocation successfully by authorized issuer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/revocations',
      headers: { cookie: issuerCookie },
      payload: {
        credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        issuerKeyHash: '0x9999999999999999999999999999999999999999999999999999999999999999',
        reasonCode: 'ACADEMIC_MISCONDUCT',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.leaf.credentialId).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');

    // Verify credential status updated in database
    const cred = await prisma.credentialRecord.findUnique({
      where: { credentialId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
    });
    expect(cred?.status).toBe('Revoked');
  });

  it('generates non-membership proof witness for unrevoked credential', async () => {
    const unrevokedId = '0x0000000000000000000000000000000000000000000000000000000000000005';
    const keyHash = '0x9999999999999999999999999999999999999999999999999999999999999999';

    const res = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${keyHash}/witness/${unrevokedId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.issuerKeyHash).toBe(keyHash);
    expect(body.witness).toBeDefined();
    expect(Array.isArray(body.witness.siblings)).toBe(true);
    expect(body.root).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('returns 409 conflict when requesting non-membership proof for revoked credential', async () => {
    const revokedId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const keyHash = '0x9999999999999999999999999999999999999999999999999999999999999999';

    const res = await app.inject({
      method: 'GET',
      url: `/v1/revocations/${keyHash}/witness/${revokedId}`,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain('Credential is revoked');
  });
});
