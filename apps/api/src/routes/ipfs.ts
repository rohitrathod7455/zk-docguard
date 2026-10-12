import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { uploadToIpfs, getFromIpfs } from '../ipfs/client.js';

const MAX_CIPHERTEXT_SIZE = 15 * 1024 * 1024; // 15 MB

export async function ipfsRoutes(app: FastifyInstance): Promise<void> {
  // 1. Upload encrypted document ciphertext
  app.post(
    '/v1/ipfs/upload',
    {
      schema: {
        description: 'Upload client-side encrypted document ciphertext to IPFS',
        tags: ['Storage'],
        body: {
          type: 'object',
          required: ['ciphertext'],
          properties: {
            ciphertext: {
              type: 'string',
              description: 'Base64 encoded ciphertext envelope',
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata (e.g. envelope headers, no personal data)',
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        ciphertext: z.string().min(1),
        metadata: z.record(z.unknown()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid upload request', details: parsed.error.issues });
      }

      const buffer = Buffer.from(parsed.data.ciphertext, 'base64');
      if (buffer.length > MAX_CIPHERTEXT_SIZE) {
        return reply.status(413).send({ error: `Ciphertext exceeds maximum limit of ${MAX_CIPHERTEXT_SIZE} bytes` });
      }

      const { cid, size } = await uploadToIpfs(new Uint8Array(buffer), parsed.data.metadata);

      return reply.status(201).send({
        cid,
        size,
      });
    },
  );

  // 2. Fetch encrypted document ciphertext by CID
  app.get(
    '/v1/ipfs/:cid',
    {
      schema: {
        description: 'Fetch encrypted document ciphertext from IPFS by CID',
        tags: ['Storage'],
        params: {
          type: 'object',
          properties: {
            cid: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { cid: string } }>, reply: FastifyReply) => {
      const { cid } = req.params;
      const data = await getFromIpfs(cid);

      if (!data) {
        return reply.status(404).send({ error: 'Content not found for given CID' });
      }

      return reply
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${cid}.enc"`)
        .send(Buffer.from(data));
    },
  );
}
