import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';

export async function sharingRoutes(app: FastifyInstance): Promise<void> {
  // 1. Create a verifier-scoped, time-limited document sharing link
  app.post(
    '/v1/sharing/links',
    {
      schema: {
        description: 'Create a verifier-scoped ephemeral document sharing request',
        tags: ['Document Sharing'],
        body: {
          type: 'object',
          required: ['cid', 'verifierPublicKey', 'verifierName', 'ttlSeconds'],
          properties: {
            cid: { type: 'string' },
            verifierPublicKey: { type: 'string' },
            verifierName: { type: 'string' },
            ttlSeconds: { type: 'number' },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        cid: z.string().min(1),
        verifierPublicKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
        verifierName: z.string().min(1),
        ttlSeconds: z.number().int().min(60).max(86400).default(900), // Default 15 mins
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid share request payload', details: parsed.error.issues });
      }

      const { cid, verifierPublicKey, verifierName, ttlSeconds } = parsed.data;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const link = await prisma.documentShareLink.create({
        data: {
          cid,
          verifierPublicKey,
          verifierName,
          expiresAt,
        },
      });

      return reply.status(201).send({
        linkId: link.id,
        cid: link.cid,
        verifierPublicKey: link.verifierPublicKey,
        verifierName: link.verifierName,
        expiresAt: link.expiresAt.toISOString(),
      });
    },
  );

  // 2. Fetch sharing request details
  app.get(
    '/v1/sharing/links/:id',
    {
      schema: {
        description: 'Fetch time-limited document sharing link details',
        tags: ['Document Sharing'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params;
      const link = await prisma.documentShareLink.findUnique({
        where: { id },
      });

      if (!link) {
        return reply.status(404).send({ error: 'Sharing link not found' });
      }

      const isExpired = new Date() > link.expiresAt;

      return reply.send({
        id: link.id,
        cid: link.cid,
        verifierPublicKey: link.verifierPublicKey,
        verifierName: link.verifierName,
        expiresAt: link.expiresAt.toISOString(),
        isExpired,
        fulfilled: link.fulfilled,
        wrappedKey: link.wrappedKey ? JSON.parse(link.wrappedKey) : null,
      });
    },
  );

  // 3. Holder fulfills sharing link with re-wrapped key package
  app.post(
    '/v1/sharing/links/:id/fulfill',
    {
      schema: {
        description: 'Holder fulfills document sharing link by submitting re-wrapped document key',
        tags: ['Document Sharing'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['wrappedKey'],
          properties: {
            wrappedKey: { type: 'object' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{
        Params: { id: string };
        Body: { wrappedKey: Record<string, unknown> };
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = req.params;
      const link = await prisma.documentShareLink.findUnique({
        where: { id },
      });

      if (!link) {
        return reply.status(404).send({ error: 'Sharing link not found' });
      }

      if (new Date() > link.expiresAt) {
        return reply.status(410).send({ error: 'Sharing link has expired' });
      }

      await prisma.documentShareLink.update({
        where: { id },
        data: {
          fulfilled: true,
          wrappedKey: JSON.stringify(req.body.wrappedKey),
        },
      });

      return reply.send({ ok: true, message: 'Document key re-wrapped and submitted successfully' });
    },
  );

  // 4. Verifier accesses fulfilled document key package
  app.post(
    '/v1/sharing/links/:id/access',
    {
      schema: {
        description: 'Verifier accesses fulfilled document key package to decrypt document',
        tags: ['Document Sharing'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params;
      const link = await prisma.documentShareLink.findUnique({
        where: { id },
      });

      if (!link) {
        return reply.status(404).send({ error: 'Sharing link not found' });
      }

      if (new Date() > link.expiresAt) {
        return reply.status(410).send({ error: 'Sharing link has expired' });
      }

      if (!link.fulfilled || !link.wrappedKey) {
        return reply.status(400).send({ error: 'Holder has not yet fulfilled this document sharing request' });
      }

      return reply.send({
        cid: link.cid,
        wrappedKey: JSON.parse(link.wrappedKey),
        expiresAt: link.expiresAt.toISOString(),
      });
    },
  );
}
