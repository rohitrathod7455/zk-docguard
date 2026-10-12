import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth } from './auth.js';

export async function issuerRoutes(app: FastifyInstance): Promise<void> {
  // 1. Institution applies as an issuer
  app.post(
    '/v1/issuers/apply',
    {
      schema: {
        description: 'Submit an institutional application to become an approved issuer',
        tags: ['Issuers'],
        body: {
          type: 'object',
          required: ['address', 'did', 'zkKeyHash', 'metadataURI'],
          properties: {
            address: { type: 'string' },
            did: { type: 'string' },
            zkKeyHash: { type: 'string' },
            metadataURI: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        did: z.string().startsWith('did:'),
        zkKeyHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        metadataURI: z.string().min(1),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid issuer application data', details: parsed.error.issues });
      }

      const address = parsed.data.address.toLowerCase();

      const existing = await prisma.issuer.findUnique({ where: { address } });
      if (existing) {
        return reply.status(409).send({ error: 'Issuer address already registered or applied' });
      }

      const issuer = await prisma.issuer.create({
        data: {
          address,
          did: parsed.data.did,
          zkKeyHash: parsed.data.zkKeyHash,
          metadataURI: parsed.data.metadataURI,
          status: 'Pending',
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'ISSUER_APPLICATION_SUBMITTED',
          actor: address,
          details: JSON.stringify({ did: parsed.data.did, zkKeyHash: parsed.data.zkKeyHash }),
        },
      });

      return reply.status(201).send({ ok: true, issuer });
    },
  );

  // 2. Get issuer profile by address
  app.get(
    '/v1/issuers/:address',
    {
      schema: {
        description: 'Retrieve issuer profile and status by address',
        tags: ['Issuers'],
        params: {
          type: 'object',
          properties: {
            address: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
      const address = req.params.address.toLowerCase();
      const issuer = await prisma.issuer.findUnique({
        where: { address },
      });

      if (!issuer) {
        return reply.status(404).send({ error: 'Issuer not found' });
      }

      return reply.send({ issuer });
    },
  );

  // 3. List issuers (with optional status filter)
  app.get(
    '/v1/issuers',
    {
      schema: {
        description: 'List institutional issuers with optional status filter',
        tags: ['Issuers'],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
      const { status } = req.query as { status?: string };
      const issuers = await prisma.issuer.findMany({
        where: status ? { status } : undefined,
        orderBy: { registeredAt: 'desc' },
      });
      return reply.send({ issuers });
    },
  );

  // 4. Admin: list issuers (with optional status filter)
  app.get(
    '/v1/admin/issuers',
    {
      schema: {
        description: 'Admin: list institutional issuers filtered by status',
        tags: ['Admin'],
      },
    },
    async (req: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(req, reply, 'admin');
      if (!session) return;

      const { status } = req.query as { status?: string };
      const issuers = await prisma.issuer.findMany({
        where: status ? { status } : undefined,
        orderBy: { registeredAt: 'desc' },
      });

      return reply.send({ issuers });
    },
  );

  // 4. Admin: approve issuer
  app.post(
    '/v1/admin/issuers/:address/approve',
    {
      schema: {
        description: 'Admin: approve a pending institutional issuer',
        tags: ['Admin'],
      },
    },
    async (req: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(req, reply, 'admin');
      if (!session) return;

      const address = req.params.address.toLowerCase();
      const issuer = await prisma.issuer.findUnique({ where: { address } });
      if (!issuer) {
        return reply.status(404).send({ error: 'Issuer not found' });
      }

      const updated = await prisma.issuer.update({
        where: { address },
        data: {
          status: 'Active',
          approvedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'ISSUER_APPROVED',
          actor: session.address,
          details: JSON.stringify({ approvedIssuer: address }),
        },
      });

      return reply.send({ ok: true, issuer: updated });
    },
  );

  // 5. Admin: suspend issuer
  app.post(
    '/v1/admin/issuers/:address/suspend',
    {
      schema: {
        description: 'Admin: suspend an active institutional issuer',
        tags: ['Admin'],
      },
    },
    async (req: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(req, reply, 'admin');
      if (!session) return;

      const address = req.params.address.toLowerCase();
      const issuer = await prisma.issuer.findUnique({ where: { address } });
      if (!issuer) {
        return reply.status(404).send({ error: 'Issuer not found' });
      }

      const updated = await prisma.issuer.update({
        where: { address },
        data: { status: 'Suspended' },
      });

      await prisma.auditLog.create({
        data: {
          action: 'ISSUER_SUSPENDED',
          actor: session.address,
          details: JSON.stringify({ suspendedIssuer: address }),
        },
      });

      return reply.send({ ok: true, issuer: updated });
    },
  );
}
