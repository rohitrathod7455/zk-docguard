import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSparseMerkleTree } from '@zk-docguard/core';
import { prisma } from '../db/client.js';
import { requireAuth } from './auth.js';

export async function revocationRoutes(app: FastifyInstance): Promise<void> {
  // 1. Issuer posts a credential revocation
  app.post(
    '/v1/revocations',
    {
      schema: {
        description: 'Record an issuer revocation for a credentialId',
        tags: ['Revocation'],
        body: {
          type: 'object',
          required: ['credentialId', 'issuerKeyHash'],
          properties: {
            credentialId: { type: 'string' },
            issuerKeyHash: { type: 'string' },
            reasonCode: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(req, reply, 'issuer');
      if (!session) return;

      const schema = z.object({
        credentialId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        issuerKeyHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
        reasonCode: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid revocation payload', details: parsed.error.issues });
      }

      // Check if credential exists
      const cred = await prisma.credentialRecord.findUnique({
        where: { credentialId: parsed.data.credentialId },
      });

      if (cred && cred.issuerAddress !== session.address && session.role !== 'admin') {
        return reply.status(403).send({ error: 'Cannot revoke credential issued by another institution' });
      }

      const leaf = await prisma.revocationLeaf.upsert({
        where: {
          issuerKeyHash_credentialId: {
            issuerKeyHash: parsed.data.issuerKeyHash,
            credentialId: parsed.data.credentialId,
          },
        },
        update: {
          revokedAt: new Date(),
          issuerAddress: session.address,
        },
        create: {
          issuerKeyHash: parsed.data.issuerKeyHash,
          credentialId: parsed.data.credentialId,
          issuerAddress: session.address,
        },
      });

      if (cred) {
        await prisma.credentialRecord.update({
          where: { credentialId: parsed.data.credentialId },
          data: { status: 'Revoked' },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: 'CREDENTIAL_REVOKED',
          actor: session.address,
          details: JSON.stringify({
            credentialId: parsed.data.credentialId,
            issuerKeyHash: parsed.data.issuerKeyHash,
            reasonCode: parsed.data.reasonCode,
          }),
        },
      });

      return reply.status(201).send({ ok: true, leaf });
    },
  );

  // 2. Fetch SMT non-membership exclusion witness for privacy-preserving verification (Mode B preview)
  app.get(
    '/v1/revocations/:issuerKeyHash/witness/:credentialId',
    {
      schema: {
        description: 'Generate SMT non-membership exclusion witness for a credentialId',
        tags: ['Revocation'],
        params: {
          type: 'object',
          properties: {
            issuerKeyHash: { type: 'string' },
            credentialId: { type: 'string' },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { issuerKeyHash: string; credentialId: string } }>,
      reply: FastifyReply,
    ) => {
      const { issuerKeyHash, credentialId } = req.params;

      // Fetch all revoked leaves for this issuerKeyHash
      const leaves = await prisma.revocationLeaf.findMany({
        where: { issuerKeyHash },
      });

      const smt = await createSparseMerkleTree();
      for (const l of leaves) {
        await smt.insert(BigInt(l.credentialId), 1n);
      }

      const targetId = BigInt(credentialId);
      const isRevoked = await smt.has(targetId);
      if (isRevoked) {
        return reply.status(409).send({ error: 'Credential is revoked (cannot generate non-membership proof)' });
      }

      const SMT_N_LEVELS = 10;
      const witness = await smt.getNonMembershipProof(targetId, SMT_N_LEVELS);

      const rootHex = '0x' + smt.getRoot().toString(16).padStart(64, '0');
      // Pad siblings to SMT_N_LEVELS for circuit compatibility
      const paddedSiblings = witness.siblings.map((s) => s.toString());
      while (paddedSiblings.length < SMT_N_LEVELS) {
        paddedSiblings.push('0');
      }

      return reply.send({
        issuerKeyHash,
        credentialId,
        root: rootHex,
        witness: {
          root: rootHex,
          oldKey: witness.oldKey.toString(),
          oldValue: witness.oldValue.toString(),
          isOld0: witness.isOld0,
          siblings: paddedSiblings,
        },
      });
    },
  );
}
