import { FastifyInstance } from 'fastify';
import { profileRoutes } from './profile';
import { resumeRoutes } from './resumes';
import { jobRoutes } from './jobs';
import { ingestRoutes } from './ingest';
import { scoringRoutes } from './scoring';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(profileRoutes, { prefix: '/api/profile' });
  await app.register(resumeRoutes, { prefix: '/api/resumes' });
  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(ingestRoutes, { prefix: '/api/ingest' });
  await app.register(scoringRoutes, { prefix: '/api/jobs' });
}
