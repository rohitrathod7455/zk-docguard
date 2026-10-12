import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createSiweNonce,
  verifySiweMessage,
  sealSession,
  unsealSession,
  SessionData,
} from '../auth/siwe.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // 1. Generate SIWE nonce
  app.post(
    '/v1/auth/siwe/nonce',
    {
      schema: {
        description: 'Generate replay-safe SIWE cryptographic nonce',
        tags: ['Authentication'],
        response: {
          200: {
            type: 'object',
            properties: {
              nonce: { type: 'string' },
            },
          },
        },
      },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const nonce = await createSiweNonce();
      return reply.send({ nonce });
    },
  );

  // 2. Verify SIWE message and issue session cookie
  app.post(
    '/v1/auth/siwe/verify',
    {
      schema: {
        description: 'Verify SIWE signature and issue httpOnly session cookie',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['message', 'signature'],
          properties: {
            message: { type: 'string' },
            signature: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        message: z.string().min(1),
        signature: z.string().min(1),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' });
      }

      const result = await verifySiweMessage(parsed.data.message, parsed.data.signature);
      if (!result.success || !result.session) {
        return reply.status(401).send({ error: result.error || 'Authentication failed' });
      }

      const sealedCookie = sealSession(result.session);

      reply.setCookie('zkdg_session', sealedCookie, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60, // 24 hours in seconds
      });

      return reply.send({
        ok: true,
        address: result.session.address,
        role: result.session.role,
      });
    },
  );

  // 3. Current user session introspection
  app.get(
    '/v1/auth/me',
    {
      schema: {
        description: 'Get current authenticated user session',
        tags: ['Authentication'],
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const cookie = req.cookies?.zkdg_session;
      if (!cookie) {
        return reply.status(401).send({ error: 'Unauthenticated' });
      }

      const session = unsealSession(cookie);
      if (!session) {
        return reply.status(401).send({ error: 'Invalid or expired session' });
      }

      return reply.send({
        address: session.address,
        role: session.role,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
      });
    },
  );

  // 4. Logout
  app.post(
    '/v1/auth/logout',
    {
      schema: {
        description: 'Terminate active session and clear cookie',
        tags: ['Authentication'],
      },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      reply.clearCookie('zkdg_session', { path: '/' });
      return reply.send({ ok: true });
    },
  );
}

/**
 * @notice Helper middleware to require an authenticated session and specific role.
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
  requiredRole?: 'admin' | 'issuer',
): Promise<SessionData | null> {
  const cookie = req.cookies?.zkdg_session;
  if (!cookie) {
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  }

  const session = unsealSession(cookie);
  if (!session) {
    reply.status(401).send({ error: 'Invalid or expired session' });
    return null;
  }

  if (requiredRole && session.role !== requiredRole && session.role !== 'admin') {
    reply.status(403).send({ error: `Forbidden: requires ${requiredRole} role` });
    return null;
  }

  return session;
}
