import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { runDailyBriefing, DailyBriefingPayload } from '../agents/dailyBriefing';
import { runGapAnalysis, GapAnalysisPayload } from '../agents/gapAnalysis';
import { runCompanySignals, CompanySignalsPayload } from '../agents/companySignal';

// Minimum time between regenerations per insight type — prevents accidental credit burn
const COOLDOWNS_MS: Record<string, number> = {
  daily_briefing:  5 * 60 * 1_000,   // 5 minutes
  gap_analysis:   15 * 60 * 1_000,   // 15 minutes
  company_signals: 10 * 60 * 1_000,  // 10 minutes
};

async function isOnCooldown(type: string): Promise<{ cooling: boolean; retryAfterSec: number }> {
  const last = await prisma.agentInsight.findFirst({
    where: { type },
    orderBy: { generatedAt: 'desc' },
    select: { generatedAt: true },
  });
  if (!last) return { cooling: false, retryAfterSec: 0 };

  const elapsed = Date.now() - last.generatedAt.getTime();
  const cooldown = COOLDOWNS_MS[type] ?? 5 * 60 * 1_000;
  if (elapsed < cooldown) {
    return { cooling: true, retryAfterSec: Math.ceil((cooldown - elapsed) / 1_000) };
  }
  return { cooling: false, retryAfterSec: 0 };
}

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

    const { cooling, retryAfterSec } = await isOnCooldown('daily_briefing');
    if (cooling) {
      reply.header('Retry-After', String(retryAfterSec));
      return reply.code(429).send({ error: `Briefing was just generated. Try again in ${retryAfterSec}s.` });
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

    const { cooling, retryAfterSec } = await isOnCooldown('gap_analysis');
    if (cooling) {
      reply.header('Retry-After', String(retryAfterSec));
      return reply.code(429).send({ error: `Gap analysis was just generated. Try again in ${retryAfterSec}s.` });
    }

    try {
      const result = await runGapAnalysis();
      return result;
    } catch (err) {
      console.error('[insights] gap analysis failed:', err instanceof Error ? err.message : String(err));
      return reply.code(500).send({ error: 'Failed to generate gap analysis' });
    }
  });

  // GET /api/insights/company-signals — latest persisted company signals
  app.get('/company-signals', async (_request, reply) => {
    const record = await prisma.agentInsight.findFirst({
      where: { type: 'company_signals' },
      orderBy: { generatedAt: 'desc' },
    });

    if (!record) return reply.code(404).send({ error: 'No company signals generated yet' });

    return {
      id: record.id,
      generatedAt: record.generatedAt,
      payload: record.payload as unknown as CompanySignalsPayload,
    };
  });

  // POST /api/insights/company-signals — run company signal detection
  app.post('/company-signals', async (_request, reply) => {
    const { cooling, retryAfterSec } = await isOnCooldown('company_signals');
    if (cooling) {
      reply.header('Retry-After', String(retryAfterSec));
      return reply.code(429).send({ error: `Company signals were just generated. Try again in ${retryAfterSec}s.` });
    }

    try {
      const result = await runCompanySignals();
      return result;
    } catch (err) {
      console.error('[insights] company signals failed:', err instanceof Error ? err.message : String(err));
      return reply.code(500).send({ error: 'Failed to generate company signals' });
    }
  });

  // GET /api/insights — chronological timeline of all insight records
  app.get('/', async (request, _reply) => {
    const { limit = '20' } = request.query as { limit?: string };
    const take = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    const records = await prisma.agentInsight.findMany({
      orderBy: { generatedAt: 'desc' },
      take,
      select: { id: true, type: true, generatedAt: true, payload: true },
    });

    return { data: records };
  });
}
