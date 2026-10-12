import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { disconnectPrisma } from '../src/db/client.js';

describe('API IPFS Ciphertext Storage Routes (/v1/ipfs)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('uploads ciphertext and returns a deterministic content-addressed CID', async () => {
    const rawData = Buffer.from('test-encrypted-document-ciphertext-envelope-12345');
    const base64Data = rawData.toString('base64');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/ipfs/upload',
      payload: {
        ciphertext: base64Data,
        metadata: {
          algorithm: 'AES-256-GCM',
          tagLength: 128,
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.cid).toBeDefined();
    expect(body.cid).toMatch(/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/);
    expect(body.size).toBe(rawData.length);

    // Retrieve via GET /v1/ipfs/:cid
    const getRes = await app.inject({
      method: 'GET',
      url: `/v1/ipfs/${body.cid}`,
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.rawPayload).toEqual(rawData);
    expect(getRes.headers['content-type']).toBe('application/octet-stream');
  });

  it('returns 404 for non-existent IPFS CID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/ipfs/QmNonExistentHash111111111111111111111111111111',
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects oversized uploads exceeding size limits', async () => {
    // 16 MB dummy buffer exceeds 15 MB limit
    const oversized = Buffer.alloc(16 * 1024 * 1024).fill(0xaa);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/ipfs/upload',
      payload: {
        ciphertext: oversized.toString('base64'),
      },
    });

    expect(res.statusCode).toBe(413);
  });
});
