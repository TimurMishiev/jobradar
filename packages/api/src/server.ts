import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  await app.register(cors, {
    origin: process.env.WEB_URL ?? 'http://localhost:5173',
  });

  // Single-user auth hook: if API_KEY is set, require it on all non-health requests
  app.addHook('onRequest', async (request, reply) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || request.url === '/health') return;

    const provided = request.headers['x-api-key'];
    if (provided !== apiKey) {
      // Must return here — without it, Fastify continues processing the request
      // even after reply.send(), resulting in the handler running despite the 401.
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/health', async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
  }));

  await registerRoutes(app);

  return app;
}
