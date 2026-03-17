import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';

const MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 30_000;

// ─── Payload types (exported so routes and frontend types can share the shape) ─

export interface BriefingTopPick {
  jobId: string;
  title: string;
  company: string;
  score: number;
  reason: string; // 1-sentence why this is the top pick
}

export interface WatchlistHighlight {
  company: string;
  newRoles: number;
  topRole: string | null;
}

export interface DailyBriefingPayload {
  headline: string;
  topPicks: BriefingTopPick[];
  appliedNudge: string | null;
  watchlistHighlights: WatchlistHighlight[];
}

export interface BriefingInsight {
  id: string;
  generatedAt: Date;
  payload: DailyBriefingPayload;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runDailyBriefing(): Promise<BriefingInsight> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey: key });

  const user = await getLocalUser();
  if (!user) throw new Error('No user found — complete profile setup first');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000);

  const [profile, actions] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.userJobAction.findMany({ where: { userId: user.id } }),
  ]);

  const ignoredJobIds = new Set(
    actions.filter((a) => a.action === 'IGNORED').map((a) => a.jobId),
  );
  const savedCount = actions.filter((a) => a.action === 'SAVED').length;
  const appliedCount = actions.filter((a) => a.action === 'APPLIED').length;
  const preferredCompanies = profile?.preferredCompanies ?? [];

  // Top scored jobs in the last 7 days, not ignored
  const topScoredJobs = await prisma.job.findMany({
    where: {
      isActive: true,
      postedAt: { gte: sevenDaysAgo },
      NOT: ignoredJobIds.size > 0 ? { id: { in: [...ignoredJobIds] } } : undefined,
      scores: { some: { score: { gte: 70 } } },
    },
    include: {
      scores: { take: 1, orderBy: { score: 'desc' } },
    },
    orderBy: { postedAt: 'desc' },
    take: 10,
  });

  const newTodayCount = await prisma.job.count({
    where: { isActive: true, postedAt: { gte: oneDayAgo } },
  });

  // Watchlist: preferred companies with new roles this week
  const watchlistData: WatchlistHighlight[] = [];
  for (const company of preferredCompanies) {
    const jobs = await prisma.job.findMany({
      where: { company, isActive: true, postedAt: { gte: sevenDaysAgo } },
      include: { scores: { take: 1, orderBy: { score: 'desc' } } },
      orderBy: { postedAt: 'desc' },
      take: 5,
    });
    if (jobs.length > 0) {
      const top = jobs.sort((a, b) => (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0))[0];
      watchlistData.push({ company, newRoles: jobs.length, topRole: top.title });
    }
  }

  // Compact context for GPT — IDs, titles, scores, top match reasons only
  const topPicksContext = [...topScoredJobs]
    .sort((a, b) => (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0))
    .slice(0, 5)
    .map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      score: j.scores[0]?.score ?? 0,
      matchReasons: j.scores[0]?.matchReasons?.slice(0, 2) ?? [],
    }));

  const prompt = buildPrompt({
    profile: {
      targetTitles: profile?.targetTitles ?? [],
      targetSkills: profile?.targetSkills ?? [],
      preferredCompanies,
    },
    savedCount,
    appliedCount,
    newTodayCount,
    strongMatchCount: topScoredJobs.length,
    topPicksContext,
    watchlistData,
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
  let output: DailyBriefingPayload;
  try {
    output = JSON.parse(raw) as DailyBriefingPayload;
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Sanitize — validate shapes AND cap string lengths before persisting
  const clamp = (s: unknown, max: number, fallback = ''): string =>
    typeof s === 'string' ? s.slice(0, max) : fallback;

  const payload: DailyBriefingPayload = {
    headline: clamp(output.headline, 300, 'No headline available.'),
    topPicks: Array.isArray(output.topPicks)
      ? output.topPicks
          .filter((p) => typeof p.jobId === 'string' && typeof p.title === 'string')
          .slice(0, 3)
          .map((p) => ({
            jobId:   clamp(p.jobId, 40),
            title:   clamp(p.title, 120),
            company: clamp(p.company, 80),
            score:   typeof p.score === 'number' ? Math.max(0, Math.min(100, Math.round(p.score))) : 0,
            reason:  clamp(p.reason, 200),
          }))
      : [],
    appliedNudge: typeof output.appliedNudge === 'string' ? clamp(output.appliedNudge, 200) : null,
    watchlistHighlights: Array.isArray(output.watchlistHighlights)
      ? output.watchlistHighlights
          .filter((w) => typeof w.company === 'string')
          .slice(0, 10)
          .map((w) => ({
            company:  clamp(w.company, 80),
            newRoles: typeof w.newRoles === 'number' ? Math.max(0, Math.round(w.newRoles)) : 0,
            topRole:  typeof w.topRole === 'string' ? clamp(w.topRole, 120) : null,
          }))
      : [],
  };

  const record = await prisma.agentInsight.create({
    data: {
      type: 'daily_briefing',
      payload: payload as object,
    },
  });

  return { id: record.id, generatedAt: record.generatedAt, payload };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(ctx: {
  profile: { targetTitles: string[]; targetSkills: string[]; preferredCompanies: string[] };
  savedCount: number;
  appliedCount: number;
  newTodayCount: number;
  strongMatchCount: number;
  topPicksContext: Array<{ id: string; title: string; company: string; score: number; matchReasons: string[] }>;
  watchlistData: WatchlistHighlight[];
}): string {
  const { profile, savedCount, appliedCount, newTodayCount, strongMatchCount, topPicksContext, watchlistData } = ctx;

  return `You are an intelligent job search assistant. Generate a concise daily briefing for the job seeker based on the data below.

Candidate profile:
- Target titles: ${profile.targetTitles.join(', ') || 'not set'}
- Target skills: ${profile.targetSkills.join(', ') || 'not set'}
- Preferred companies: ${profile.preferredCompanies.join(', ') || 'none'}

Job activity:
- Saved: ${savedCount} · Applied: ${appliedCount}
- New jobs posted today: ${newTodayCount}
- Strong matches this week (score ≥70): ${strongMatchCount}

Top scored jobs this week:
${topPicksContext.length > 0
  ? topPicksContext.map((j) => `- [${j.id}] ${j.title} at ${j.company} (${j.score}) — ${j.matchReasons.join('; ') || 'no reasons'}`).join('\n')
  : '  None scored yet.'}

Watchlist highlights (last 7 days):
${watchlistData.length > 0
  ? watchlistData.map((w) => `- ${w.company}: ${w.newRoles} new role(s), top: ${w.topRole}`).join('\n')
  : '  None.'}

Return ONLY valid JSON with this exact shape:
{
  "headline": "<1-2 sentence data-driven summary of today's job situation>",
  "topPicks": [
    { "jobId": "<exact id>", "title": "<title>", "company": "<company>", "score": <score>, "reason": "<1-sentence why>" }
  ],
  "appliedNudge": "<brief actionable nudge if user has saved jobs but not applied, or null>",
  "watchlistHighlights": [
    { "company": "<company>", "newRoles": <count>, "topRole": "<title or null>" }
  ]
}

Rules:
- topPicks: up to 3, ordered by fit; only jobs from the list above
- headline: specific and data-driven, never generic like "you have some matches"
- appliedNudge: null if applied > 0 or saved === 0
- watchlistHighlights: only companies that have new roles this week`;
}
