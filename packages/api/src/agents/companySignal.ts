import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';
import type { CompanySignalKind, CompanySignal, CompanySignalsPayload } from '@jobradar/shared';

export type { CompanySignalKind, CompanySignal, CompanySignalsPayload };

export interface CompanySignalsInsight {
  id: string;
  generatedAt: Date;
  payload: CompanySignalsPayload;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const WINDOW_DAYS = 7;
const HIRING_CLUSTER_MIN_ROLES = 3;   // ≥3 roles posted in window → hiring cluster
const SKILL_MATCH_CLUSTER_MIN_ROLES = 2; // ≥2 high-score roles at same company

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runCompanySignals(): Promise<CompanySignalsInsight> {
  const user = await getLocalUser();
  if (!user) throw new Error('No user found — complete profile setup first');

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1_000);

  // Fetch all active jobs posted within the window, with their top score
  const recentJobs = await prisma.job.findMany({
    where: { isActive: true, postedAt: { gte: windowStart } },
    select: {
      id: true,
      company: true,
      title: true,
      postedAt: true,
      scores: {
        orderBy: { score: 'desc' },
        take: 1,
        select: { score: true },
      },
    },
  });

  // Group by company
  const byCompany = new Map<string, typeof recentJobs>();
  for (const job of recentJobs) {
    const list = byCompany.get(job.company) ?? [];
    list.push(job);
    byCompany.set(job.company, list);
  }

  const signals: CompanySignal[] = [];

  for (const [company, jobs] of byCompany) {
    // HIRING_CLUSTER — company posted many roles this week
    if (jobs.length >= HIRING_CLUSTER_MIN_ROLES) {
      const topRole = [...jobs]
        .sort((a, b) => (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0))[0]?.title ?? null;

      signals.push({
        company,
        kind: 'HIRING_CLUSTER',
        description: `${company} posted ${jobs.length} role${jobs.length === 1 ? '' : 's'} in the last ${WINDOW_DAYS} days`,
        roleCount: jobs.length,
        topRole,
      });
    }

    // SKILL_MATCH_CLUSTER — multiple high-score roles at same company
    const highScoreJobs = jobs.filter((j) => (j.scores[0]?.score ?? 0) >= 70);
    if (highScoreJobs.length >= SKILL_MATCH_CLUSTER_MIN_ROLES) {
      const topRole = [...highScoreJobs]
        .sort((a, b) => (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0))[0]?.title ?? null;

      signals.push({
        company,
        kind: 'SKILL_MATCH_CLUSTER',
        description: `${company} has ${highScoreJobs.length} strong-match role${highScoreJobs.length === 1 ? '' : 's'} this week`,
        roleCount: highScoreJobs.length,
        topRole,
      });
    }
  }

  // Sort: skill match clusters first (more actionable), then hiring clusters; within each, by role count desc
  signals.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'SKILL_MATCH_CLUSTER' ? -1 : 1;
    return b.roleCount - a.roleCount;
  });

  const payload: CompanySignalsPayload = {
    signals,
    generatedAt: new Date().toISOString(),
    basedOnDays: WINDOW_DAYS,
  };

  const record = await prisma.agentInsight.create({
    data: { type: 'company_signals', payload: payload as object },
  });

  return { id: record.id, generatedAt: record.generatedAt, payload };
}
