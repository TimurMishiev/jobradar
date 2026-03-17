import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import path from 'path';
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

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB max
      files: 1,
    },
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

  // Production: serve the web SPA static build.
  // Set WEB_DIST_PATH to the absolute path of packages/web/dist in the container.
  // In dev this is unset — Vite dev server handles the web.
  const webDistPath = process.env.WEB_DIST_PATH
    ? path.resolve(process.env.WEB_DIST_PATH)
    : null;

  if (webDistPath) {
    await app.register(staticPlugin, { root: webDistPath, wildcard: false });

    // SPA catch-all: serve index.html for all non-API paths
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/health')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html', webDistPath);
    });
  }

  return app;
}
