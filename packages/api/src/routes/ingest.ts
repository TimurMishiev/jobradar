import { FastifyInstance } from 'fastify';
import { runIngestion } from '../services/ingestion';
import { TARGET_COMPANIES } from '../companies';

const VALID_SLUGS = new Set(TARGET_COMPANIES.map((c) => c.slug));

export async function ingestRoutes(app: FastifyInstance) {
  // POST /api/ingest — manually trigger ingestion
  // Body (optional): { companies: string[] }  ← array of company slugs, or omit for all
  app.post('/', async (request, reply) => {
    const body = (request.body ?? {}) as { companies?: unknown };

    // Validate that companies, if provided, is an array of known slugs
    if (body.companies !== undefined) {
      if (!Array.isArray(body.companies)) {
        return reply.code(400).send({ error: 'companies must be an array of slugs' });
      }
      const invalid = (body.companies as unknown[]).filter(
        (s) => typeof s !== 'string' || !VALID_SLUGS.has(s),
      );
      if (invalid.length > 0) {
        return reply.code(400).send({
          error: `Unknown company slugs: ${invalid.join(', ')}`,
          validSlugs: Array.from(VALID_SLUGS),
        });
      }
    }

    const slugFilter = Array.isArray(body.companies) && body.companies.length > 0
      ? (body.companies as string[])
      : undefined;

    app.log.info({ slugFilter }, 'Starting ingestion');

    const summary = await runIngestion(slugFilter);

    return reply.code(200).send(summary);
  });

  // GET /api/ingest/companies — list configured target companies
  app.get('/companies', async () => {
    return TARGET_COMPANIES.map((c) => ({
      name: c.name,
      slug: c.slug,
      ats: c.ats,
    }));
  });
}
