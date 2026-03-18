import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';
import { getOpenAIClient } from '../lib/openai';
import type { GapAnalysisPayload, SkillGap } from '@jobradar/shared';

export type { GapAnalysisPayload, SkillGap };

const MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 30_000;
const MIN_SCORE = 60;        // jobs below this threshold are excluded from analysis
const MAX_JOBS = 40;         // cap to keep the prompt compact
const MIN_JOBS_WITH_GAPS = 3; // minimum before we call GPT

export interface GapAnalysisInsight {
  id: string;
  generatedAt: Date;
  payload: GapAnalysisPayload;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runGapAnalysis(): Promise<GapAnalysisInsight> {
  const client = getOpenAIClient();

  const user = await getLocalUser();
  if (!user) throw new Error('No user found');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);

  const [profile, actions] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.userJobAction.findMany({
      where: { userId: user.id, action: 'IGNORED' },
      select: { jobId: true },
    }),
  ]);

  const ignoredJobIds = new Set(actions.map((a) => a.jobId));

  // Fetch top-scored jobs with their latest score (includes missingSignals)
  const scoredJobs = await prisma.job.findMany({
    where: {
      isActive: true,
      postedAt: { gte: thirtyDaysAgo },
      NOT: ignoredJobIds.size > 0 ? { id: { in: [...ignoredJobIds] } } : undefined,
      scores: { some: { score: { gte: MIN_SCORE } } },
    },
    include: {
      scores: {
        where: { score: { gte: MIN_SCORE } },
        orderBy: { score: 'desc' },
        take: 1,
      },
    },
    orderBy: { postedAt: 'desc' },
    take: MAX_JOBS,
  });

  // Collect all missing signals from the qualifying scores
  const jobsWithGaps = scoredJobs.filter((j) => j.scores[0]?.missingSignals?.length > 0);

  if (jobsWithGaps.length < MIN_JOBS_WITH_GAPS) {
    // Not enough data — store a "no data" insight rather than calling GPT
    const payload: GapAnalysisPayload = {
      summary: 'Not enough scored jobs to detect patterns yet. Score more jobs to unlock gap analysis.',
      topGaps: [],
      recommendation: 'Score more jobs by opening them or running a manual scoring pass.',
      basedOnJobCount: scoredJobs.length,
      minScore: MIN_SCORE,
    };
    const record = await prisma.agentInsight.create({
      data: { type: 'gap_analysis', payload: payload as object },
    });
    return { id: record.id, generatedAt: record.generatedAt, payload };
  }

  // Count frequency of each signal (deterministic — no GPT involved in counting)
  const signalCounts = new Map<string, number>();
  for (const job of jobsWithGaps) {
    const signals = job.scores[0]?.missingSignals ?? [];
    for (const raw of signals) {
      const key = raw.trim().toLowerCase();
      if (key) signalCounts.set(key, (signalCounts.get(key) ?? 0) + 1);
    }
  }

  // Top 15 signals by frequency for the GPT prompt (keeps context compact)
  const topSignals = [...signalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([signal, count]) => ({ signal, count }));

  // Job context: titles for clusters GPT can reference
  const jobContext = jobsWithGaps.slice(0, 15).map((j) => ({
    title: j.title,
    company: j.company,
    score: j.scores[0]?.score ?? 0,
    gaps: j.scores[0]?.missingSignals?.slice(0, 3) ?? [],
  }));

  const prompt = buildPrompt({
    profile: {
      targetTitles: profile?.targetTitles ?? [],
      targetSkills: profile?.targetSkills ?? [],
    },
    topSignals,
    jobContext,
    totalJobsAnalyzed: scoredJobs.length,
    jobsWithGapsCount: jobsWithGaps.length,
  });

  const completion = await client.chat.completions.create(
    {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    },
    { signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS) },
  );

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let output: GapAnalysisPayload;
  try {
    output = JSON.parse(raw) as GapAnalysisPayload;
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Sanitize — validate shapes AND cap string lengths before persisting
  const clamp = (s: unknown, max: number, fallback = ''): string =>
    typeof s === 'string' ? s.slice(0, max) : fallback;

  const payload: GapAnalysisPayload = {
    summary:        clamp(output.summary, 600),
    recommendation: clamp(output.recommendation, 400),
    topGaps: Array.isArray(output.topGaps)
      ? output.topGaps
          .filter((g) => typeof g.skill === 'string' && typeof g.count === 'number')
          .slice(0, 6)
          .map((g) => ({
            skill:   clamp(g.skill, 80),
            count:   Math.max(0, Math.round(g.count)),
            context: clamp(g.context, 200),
          }))
      : [],
    basedOnJobCount: scoredJobs.length,
    minScore: MIN_SCORE,
  };

  const record = await prisma.agentInsight.create({
    data: { type: 'gap_analysis', payload: payload as object },
  });

  return { id: record.id, generatedAt: record.generatedAt, payload };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(ctx: {
  profile: { targetTitles: string[]; targetSkills: string[] };
  topSignals: Array<{ signal: string; count: number }>;
  jobContext: Array<{ title: string; company: string; score: number; gaps: string[] }>;
  totalJobsAnalyzed: number;
  jobsWithGapsCount: number;
}): string {
  const { profile, topSignals, jobContext, totalJobsAnalyzed, jobsWithGapsCount } = ctx;

  return `You are a career positioning analyst. Based on recurring missing signals from a job seeker's top-matched roles, identify the most important skill gaps and give actionable advice.

Candidate profile:
- Target titles: ${profile.targetTitles.join(', ') || 'not set'}
- Target skills: ${profile.targetSkills.join(', ') || 'not set'}

Analysis scope: ${totalJobsAnalyzed} scored jobs (≥60), ${jobsWithGapsCount} with skill gaps identified.

Recurring missing signals (pre-counted across all scored jobs):
${topSignals.map((s) => `- "${s.signal}" — mentioned ${s.count} time(s)`).join('\n')}

Job context (sample of roles with gaps):
${jobContext.map((j) => `- ${j.title} at ${j.company} (score ${j.score}): gaps: ${j.gaps.join(', ')}`).join('\n')}

Return ONLY valid JSON with this exact shape:
{
  "summary": "<2-3 sentence overview of the pattern — specific, not generic>",
  "topGaps": [
    { "skill": "<canonical skill name>", "count": <integer>, "context": "<1 sentence on where/why this gap shows up>" }
  ],
  "recommendation": "<1-2 actionable sentences on what to prioritize>"
}

Rules:
- topGaps: up to 6, ordered by count descending; use canonical skill names (e.g. "GraphQL" not "graphql")
- summary: name the actual skills — never say "some technical skills" or vague patterns
- recommendation: concrete and specific to the top 2-3 gaps found
- count values must match the pre-counted data above`;
}
