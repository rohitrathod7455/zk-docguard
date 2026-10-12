import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth } from './auth.js';

export async function credentialRoutes(app: FastifyInstance): Promise<void> {
  // 1. Anchor / record credential transaction
  app.post(
    '/v1/credentials/anchor',
    {
      schema: {
        description: 'Record an anchored credential after on-chain transaction submission',
        tags: ['Credentials'],
        body: {
          type: 'object',
          required: ['docHash', 'credentialId', 'schemaId', 'cid', 'expiry', 'txHash'],
          properties: {
            docHash: { type: 'string' },
            credentialId: { type: 'string' },
            schemaId: { type: 'string' },
            cid: { type: 'string' },
            expiry: { type: 'string' },
            txHash: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(req, reply, 'issuer');
      if (!session) return;

      const schema = z.object({
        docHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        credentialId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        schemaId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        cid: z.string().min(1),
        expiry: z.union([z.string(), z.number(), z.bigint()]),
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid anchor payload', details: parsed.error.issues });
      }

      const expiryBI = BigInt(parsed.data.expiry);

      const record = await prisma.credentialRecord.upsert({
        where: { docHash: parsed.data.docHash },
        update: {
          credentialId: parsed.data.credentialId,
          schemaId: parsed.data.schemaId,
          cid: parsed.data.cid,
          status: 'Valid',
          expiry: expiryBI,
          issuerAddress: session.address,
          txHash: parsed.data.txHash,
        },
        create: {
          docHash: parsed.data.docHash,
          credentialId: parsed.data.credentialId,
          schemaId: parsed.data.schemaId,
          cid: parsed.data.cid,
          status: 'Valid',
          expiry: expiryBI,
          issuerAddress: session.address,
          txHash: parsed.data.txHash,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'CREDENTIAL_ANCHORED',
          actor: session.address,
          details: JSON.stringify({
            docHash: parsed.data.docHash,
            credentialId: parsed.data.credentialId,
            txHash: parsed.data.txHash,
          }),
        },
      });

      return reply.status(201).send({
        ok: true,
        record: {
          ...record,
          expiry: record.expiry.toString(),
        },
      });
    },
  );

  // 2. Query credential by document hash
  app.get(
    '/v1/credentials/by-doc-hash/:hash',
    {
      schema: {
        description: 'Lookup credential anchor record by document hash',
        tags: ['Credentials'],
        params: {
          type: 'object',
          properties: {
            hash: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) => {
      const { hash } = req.params;
      const record = await prisma.credentialRecord.findUnique({
        where: { docHash: hash },
        include: { issuer: true },
      });

      if (!record) {
        return reply.status(404).send({ error: 'Credential record not found' });
      }

      return reply.send({
        record: {
          ...record,
          expiry: record.expiry.toString(),
        },
      });
    },
  );
}
