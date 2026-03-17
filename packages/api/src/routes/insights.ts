import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { runDailyBriefing, DailyBriefingPayload } from '../agents/dailyBriefing';
import { runGapAnalysis, GapAnalysisPayload } from '../agents/gapAnalysis';

export async function insightRoutes(app: FastifyInstance) {
  // GET /api/insights/daily-briefing — returns latest persisted briefing
  app.get('/daily-briefing', async (_request, reply) => {
    const record = await prisma.agentInsight.findFirst({
      where: { type: 'daily_briefing' },
      orderBy: { generatedAt: 'desc' },
    });

    if (!record) return reply.code(404).send({ error: 'No briefing generated yet' });

    return {
      id: record.id,
      generatedAt: record.generatedAt,
      payload: record.payload as unknown as DailyBriefingPayload,
    };
  });

  // POST /api/insights/daily-briefing — generate a new briefing
  app.post('/daily-briefing', async (_request, reply) => {
    if (!process.env.OPENAI_API_KEY) {
      return reply.code(503).send({ error: 'OPENAI_API_KEY not configured' });
    }

    try {
      const result = await runDailyBriefing();
      return result;
    } catch (err) {
      console.error('[insights] daily briefing failed:', err instanceof Error ? err.message : String(err));
      return reply.code(500).send({ error: 'Failed to generate briefing' });
    }
  });

  // GET /api/insights/gap-analysis — latest persisted gap analysis
  app.get('/gap-analysis', async (_request, reply) => {
    const record = await prisma.agentInsight.findFirst({
      where: { type: 'gap_analysis' },
      orderBy: { generatedAt: 'desc' },
    });

    if (!record) return reply.code(404).send({ error: 'No gap analysis generated yet' });

    return {
      id: record.id,
      generatedAt: record.generatedAt,
      payload: record.payload as unknown as GapAnalysisPayload,
    };
  });

  // POST /api/insights/gap-analysis — generate a new gap analysis
  app.post('/gap-analysis', async (_request, reply) => {
    if (!process.env.OPENAI_API_KEY) {
      return reply.code(503).send({ error: 'OPENAI_API_KEY not configured' });
    }

    try {
      const result = await runGapAnalysis();
      return result;
    } catch (err) {
      console.error('[insights] gap analysis failed:', err instanceof Error ? err.message : String(err));
      return reply.code(500).send({ error: 'Failed to generate gap analysis' });
    }
  });
}
