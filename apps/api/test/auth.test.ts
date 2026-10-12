import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { SiweMessage } from 'siwe';
import { buildApp } from '../src/server.js';
import { prisma, disconnectPrisma } from '../src/db/client.js';

describe('API Auth Routes (/v1/auth)', () => {
  let app: FastifyInstance;
  const adminAccount = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  ); // Hardhat 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  const userAccount = privateKeyToAccount(generatePrivateKey());

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await disconnectPrisma();
  });

  it('generates a fresh SIWE nonce', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/nonce',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.nonce).toBeDefined();
    expect(body.nonce.length).toBeGreaterThanOrEqual(16);
  });

  it('authenticates admin account via SIWE and assigns admin role', async () => {
    // 1. Fetch nonce
    const nonceRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/nonce',
    });
    const { nonce } = JSON.parse(nonceRes.body);

    // 2. Prepare SIWE message
    const siweMessage = new SiweMessage({
      domain: 'localhost',
      address: adminAccount.address,
      statement: 'Sign in to ZK-DocGuard',
      uri: 'http://localhost:3001',
      version: '1',
      chainId: 31337,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const messageStr = siweMessage.prepareMessage();
    const signature = await adminAccount.signMessage({ message: messageStr });

    // 3. Verify SIWE
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/verify',
      payload: {
        message: messageStr,
        signature,
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const body = JSON.parse(verifyRes.body);
    expect(body.ok).toBe(true);
    expect(body.address.toLowerCase()).toBe(adminAccount.address.toLowerCase());
    expect(body.role).toBe('admin');

    const cookieHeader = verifyRes.headers['set-cookie'];
    expect(cookieHeader).toBeDefined();

    // 4. Introspect session via /v1/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        cookie: cookieHeader as string,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.role).toBe('admin');
  });

  it('rejects replayed SIWE nonce (single-use guarantee)', async () => {
    const nonceRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/nonce',
    });
    const { nonce } = JSON.parse(nonceRes.body);

    const siweMessage = new SiweMessage({
      domain: 'localhost',
      address: userAccount.address,
      statement: 'Sign in to ZK-DocGuard',
      uri: 'http://localhost:3001',
      version: '1',
      chainId: 31337,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const messageStr = siweMessage.prepareMessage();
    const signature = await userAccount.signMessage({ message: messageStr });

    // First use passes
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/verify',
      payload: { message: messageStr, signature },
    });
    expect(res1.statusCode).toBe(200);

    // Replay with identical nonce fails
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/verify',
      payload: { message: messageStr, signature },
    });
    expect(res2.statusCode).toBe(401);
    expect(JSON.parse(res2.body).error).toContain('nonce');
  });

  it('rejects invalid or forged SIWE signature', async () => {
    const nonceRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/nonce',
    });
    const { nonce } = JSON.parse(nonceRes.body);

    const siweMessage = new SiweMessage({
      domain: 'localhost',
      address: userAccount.address,
      statement: 'Sign in to ZK-DocGuard',
      uri: 'http://localhost:3001',
      version: '1',
      chainId: 31337,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const messageStr = siweMessage.prepareMessage();
    // Tampered signature
    const forgedSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c';

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/siwe/verify',
      payload: { message: messageStr, signature: forgedSignature },
    });
    expect(res.statusCode).toBe(401);
  });

  it('clears session on logout', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
    const cookieHeader = res.headers['set-cookie'] as string;
    expect(cookieHeader).toContain('zkdg_session=;');
  });
});
