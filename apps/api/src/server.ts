import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { authRoutes } from './routes/auth.js';
import { issuerRoutes } from './routes/issuers.js';
import { ipfsRoutes } from './routes/ipfs.js';
import { credentialRoutes } from './routes/credentials.js';
import { revocationRoutes } from './routes/revocations.js';
import { sessionRoutes } from './routes/sessions.js';
import { verifyRoutes } from './routes/verify.js';
import { sharingRoutes } from './routes/sharing.js';
import { disconnectPrisma } from './db/client.js';
import { blockchainIndexer } from './indexer/worker.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.cookie', 'req.headers.authorization'],
    },
  });

  // 1. Security headers (Helmet)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
      },
    },
  });

  // 2. Strict CORS
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow localhost dev servers or same-origin
      if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        cb(null, true);
        return;
      }
      cb(null, true); // Dev default
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // 3. Rate Limiting
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // 4. Session Cookies
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET || 'dev-secret-key-zk-docguard-minimum-32-chars!!',
    parseOptions: {},
  });

  // 5. OpenAPI Swagger Docs
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'ZK-DocGuard API',
        description: 'Privacy-Preserving Blockchain Document Verification System API',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://localhost:${process.env.API_PORT ?? 3001}`,
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'Authentication', description: 'Sign-In with Ethereum (SIWE) and sessions' },
        { name: 'Issuers', description: 'Institutional issuer application and management' },
        { name: 'Credentials', description: 'On-chain anchored credential metadata' },
        { name: 'Storage', description: 'Client-side encrypted IPFS document storage' },
        { name: 'Verification', description: 'Groth16 ZK proof verification sessions & SSE' },
        { name: 'Revocation', description: 'On-chain and SMT revocation management' },
        { name: 'System', description: 'Health and metrics' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // 6. Register route modules
  await app.register(authRoutes);
  await app.register(issuerRoutes);
  await app.register(ipfsRoutes);
  await app.register(credentialRoutes);
  await app.register(revocationRoutes);
  await app.register(sessionRoutes);
  await app.register(verifyRoutes);
  await app.register(sharingRoutes);

  return app;
}

/* v8 ignore start */
export const start = async () => {
  const app = await buildApp();
  const host = process.env.API_HOST ?? '0.0.0.0';
  const port = Number(process.env.API_PORT ?? 3001);

  // Graceful shutdown handling
  const closeSignals = ['SIGINT', 'SIGTERM'] as const;
  for (const signal of closeSignals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      blockchainIndexer.stop();
      await app.close();
      await disconnectPrisma();
      process.exit(0);
    });
  }

  try {
    // Start background event indexer
    blockchainIndexer.start(5000);

    await app.listen({ host, port });
    app.log.info(`ZK-DocGuard API listening on ${host}:${port}`);
    app.log.info(`OpenAPI documentation available at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  start();
}
/* v8 ignore stop */
