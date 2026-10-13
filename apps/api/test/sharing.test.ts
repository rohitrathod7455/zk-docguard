import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { sharingRoutes } from '../src/routes/sharing.js';
import { prisma } from '../src/db/client.js';

describe('API Ephemeral Sharing Routes (/v1/sharing)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(sharingRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates an ephemeral document share request link', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sharing/links',
      payload: {
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        verifierPublicKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        verifierName: 'Employer HR Verification',
        ttlSeconds: 600,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.linkId).toBeDefined();
    expect(body.cid).toBe('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');
    expect(body.verifierName).toBe('Employer HR Verification');
  });

  it('handles holder fulfillment and verifier access workflow', async () => {
    // 1. Create link
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/sharing/links',
      payload: {
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        verifierPublicKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        verifierName: 'Embassy Visa Dept',
        ttlSeconds: 3600,
      },
    });
    const linkId = JSON.parse(createRes.payload).linkId;

    // 2. Fetch details before fulfillment
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/sharing/links/${linkId}`,
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.fulfilled).toBe(false);

    // 3. Holder fulfills with wrapped key
    const dummyWrappedKey = {
      ephemeralPublicKey: 'aabbccdd0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      iv: '11223344556677889900aabb',
      tag: '11223344556677889900aabbccddeeff',
      ciphertext: 'deadbeef12345678',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    const fulfillRes = await app.inject({
      method: 'POST',
      url: `/v1/sharing/links/${linkId}/fulfill`,
      payload: { wrappedKey: dummyWrappedKey },
    });
    expect(fulfillRes.statusCode).toBe(200);

    // 4. Verifier accesses fulfilled document package
    const accessRes = await app.inject({
      method: 'POST',
      url: `/v1/sharing/links/${linkId}/access`,
    });
    expect(accessRes.statusCode).toBe(200);
    const accessBody = JSON.parse(accessRes.payload);
    expect(accessBody.wrappedKey).toEqual(dummyWrappedKey);
  });
});
