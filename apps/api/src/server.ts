import Fastify from 'fastify';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

app.get('/health', async () => {
  return { status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() };
});

export const start = async () => {
  const host = process.env.API_HOST ?? '0.0.0.0';
  const port = Number(process.env.API_PORT ?? 3001);
  try {
    await app.listen({ host, port });
    app.log.info(`ZK-DocGuard API listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  start();
}

export { app };
