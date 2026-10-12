import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';

export async function verifyRoutes(app: FastifyInstance): Promise<void> {
  // 1. Raw document hash verification (non-ZK hash check)
  app.post(
    '/v1/verify/document',
    {
      schema: {
        description: 'Verify raw document hash against the blockchain registry index',
        tags: ['Verification'],
        body: {
          type: 'object',
          required: ['docHash'],
          properties: {
            docHash: {
              type: 'string',
              description: '0x-prefixed 32-byte SHA-256 hash of document bytes',
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        docHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid docHash format', details: parsed.error.issues });
      }

      const { docHash } = parsed.data;

      const record = await prisma.credentialRecord.findUnique({
        where: { docHash },
        include: { issuer: true },
      });

      if (!record) {
        return reply.send({
          status: 'Unknown',
          docHash,
          message: 'Document hash is not registered in the system',
        });
      }

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      let effectiveStatus = record.status;

      if (record.status === 'Revoked') {
        effectiveStatus = 'Revoked';
      } else if (record.expiry > 0n && record.expiry < nowSec) {
        effectiveStatus = 'Expired';
      } else if (record.issuer && (record.issuer.status === 'Suspended' || record.issuer.status === 'Revoked')) {
        effectiveStatus = 'IssuerSuspended';
      } else {
        effectiveStatus = 'Valid';
      }

      return reply.send({
        status: effectiveStatus,
        docHash: record.docHash,
        credentialId: record.credentialId,
        schemaId: record.schemaId,
        cid: record.cid,
        issuer: {
          address: record.issuer.address,
          did: record.issuer.did,
          status: record.issuer.status,
          metadataURI: record.issuer.metadataURI,
        },
        issuedAt: record.issuedAt.toISOString(),
        expiry: record.expiry.toString(),
        txHash: record.txHash,
      });
    },
  );

  // 2. Health check endpoint
  app.get(
    '/health',
    {
      schema: {
        description: 'System health status and version check',
        tags: ['System'],
      },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      });
    },
  );

  // 3. System metrics
  app.get(
    '/v1/metrics',
    {
      schema: {
        description: 'System metrics and resource counts',
        tags: ['System'],
      },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const [totalIssuers, activeIssuers, totalCredentials, totalSessions] =
        await Promise.all([
          prisma.issuer.count(),
          prisma.issuer.count({ where: { status: 'Active' } }),
          prisma.credentialRecord.count(),
          prisma.verificationSession.count(),
        ]);

      return reply.send({
        issuers: {
          total: totalIssuers,
          active: activeIssuers,
        },
        credentials: {
          total: totalCredentials,
        },
        sessions: {
          total: totalSessions,
        },
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    },
  );
}
