import { FastifyInstance } from 'fastify';
import { scoreJob, ScoreTrigger } from '../services/scoring';

export async function scoringRoutes(app: FastifyInstance) {
  // POST /api/jobs/:id/score
  // Scores a job against the current user profile and default resume.
  // Returns the saved JobScore. Re-scores if called again.
  app.post('/:id/score', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!process.env.OPENAI_API_KEY) {
      return reply.code(503).send({ error: 'Scoring is not configured — set OPENAI_API_KEY' });
    }

    try {
      const result = await scoreJob(id, ScoreTrigger.MANUAL);
      return reply.code(200).send(result);
    } catch (err) {
      const message = (err as Error).message;

      if (message === 'Job not found') return reply.code(404).send({ error: message });
      if (message.startsWith('No user found')) return reply.code(400).send({ error: message });

      // Unexpected error — log and return 500
      process.stderr.write(`Scoring error for job ${id}: ${message}\n`);
      return reply.code(500).send({ error: 'Scoring failed' });
    }
  });
}
