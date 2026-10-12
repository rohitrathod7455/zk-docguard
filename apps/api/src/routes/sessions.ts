import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'node:crypto';
import { z } from 'zod';
import { poseidonHash, stringToField } from '@zk-docguard/core';
import { prisma } from '../db/client.js';
import { verifyPresentationSubmission, PresentationSubmission } from '../services/verification.js';
import { sessionEvents } from '../services/events.js';

const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // 1. Verifier creates a new verification session
  app.post(
    '/v1/sessions',
    {
      schema: {
        description: 'Create a new verification request session with QR payload and challenge',
        tags: ['Verification'],
        body: {
          type: 'object',
          required: ['verifierName', 'domain', 'request'],
          properties: {
            verifierName: { type: 'string' },
            domain: { type: 'string' },
            request: {
              type: 'object',
              description: 'Presentation claims specification (trusted issuers, required slots, predicates)',
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        verifierName: z.string().min(1),
        domain: z.string().min(1),
        request: z.record(z.unknown()),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid session creation payload', details: parsed.error.issues });
      }

      // Generate nonce and challenge
      const nonceBytes = crypto.randomBytes(16);
      const nonce = '0x' + nonceBytes.toString('hex');
      const nonceField = BigInt(nonce);
      const domainHash = stringToField(parsed.data.domain);
      const challengeBI = await poseidonHash([nonceField, domainHash]);
      const challenge = challengeBI.toString();

      const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);
      const sessionId = crypto.randomUUID();

      const qrPayload = JSON.stringify({
        sessionId,
        verifierName: parsed.data.verifierName,
        domain: parsed.data.domain,
        challenge,
        nonce,
        request: parsed.data.request,
        expiresAt: expiresAt.toISOString(),
      });

      const session = await prisma.verificationSession.create({
        data: {
          id: sessionId,
          verifierName: parsed.data.verifierName,
          domain: parsed.data.domain,
          requestJson: JSON.stringify(parsed.data.request),
          nonce,
          challenge,
          expiresAt,
          status: 'PENDING',
        },
      });

      return reply.status(201).send({
        sessionId: session.id,
        nonce,
        challenge,
        expiresAt: expiresAt.toISOString(),
        qrPayload,
      });
    },
  );

  // 2. Holder wallet fetches session request details
  app.get(
    '/v1/sessions/:id',
    {
      schema: {
        description: 'Fetch verification request session details by sessionId',
        tags: ['Verification'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await prisma.verificationSession.findUnique({
        where: { id: req.params.id },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Verification session not found' });
      }

      return reply.send({
        sessionId: session.id,
        verifierName: session.verifierName,
        domain: session.domain,
        challenge: session.challenge,
        nonce: session.nonce,
        request: JSON.parse(session.requestJson),
        status: session.status,
        expiresAt: session.expiresAt.toISOString(),
        result: session.resultJson ? JSON.parse(session.resultJson) : null,
      });
    },
  );

  // 3. Holder wallet submits Groth16 presentation proof
  app.post(
    '/v1/sessions/:id/presentation',
    {
      schema: {
        description: 'Submit Groth16 zero-knowledge presentation proof for verification',
        tags: ['Verification'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['proof', 'publicSignals'],
          properties: {
            proof: { type: 'object' },
            publicSignals: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: PresentationSubmission }>,
      reply: FastifyReply,
    ) => {
      const { id } = req.params;
      const submission = req.body;

      const result = await verifyPresentationSubmission(id, submission);
      if (!result.success) {
        // Emit failure event to SSE subscribers
        sessionEvents.emitSessionUpdate(id, {
          status: 'REJECTED',
          reasonCode: result.reasonCode,
          error: result.error,
        });

        return reply.status(400).send({
          ok: false,
          reasonCode: result.reasonCode,
          error: result.error,
        });
      }

      return reply.send({
        ok: true,
        reasonCode: result.reasonCode,
        receipt: result.receipt,
      });
    },
  );

  // 4. Server-Sent Events (SSE) for live session updates
  app.get(
    '/v1/sessions/:id/events',
    {
      schema: {
        description: 'Server-Sent Events stream for real-time verification session status',
        tags: ['Verification'],
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
      const session = await prisma.verificationSession.findUnique({
        where: { id },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Verification session not found' });
      }

      // Configure SSE response headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');

      // Send initial state
      reply.raw.write(
        `data: ${JSON.stringify({
          status: session.status,
          result: session.resultJson ? JSON.parse(session.resultJson) : null,
        })}\n\n`,
      );

      // Subscribe to updates
      const unsubscribe = sessionEvents.subscribe(id, (data) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      });

      req.raw.on('close', () => {
        unsubscribe();
      });
    },
  );
}
