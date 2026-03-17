import { prisma } from './prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpportunitySignalKind =
  | 'preferred_company'  // company is in the user's watchlist
  | 'score_improved'     // score went up after a rescore
  | 'score_trending_up'  // score has risen monotonically over last 3 rescores (Δ≥10)
  | 'prior_interaction'  // user saved/applied to another role at this company
  | 'role_open';         // role has been open ≥ STALE_THRESHOLD_DAYS days

export interface OpportunitySignal {
  kind: OpportunitySignalKind;
  label: string; // pre-rendered, ready to display
}

// ─── Context (fetched once per request, shared across all jobs) ───────────────

export interface SignalsContext {
  preferredCompanies: Set<string>;   // company names, lowercased
  appliedCompanies: Set<string>;     // companies where user has APPLIED, lowercased
  savedCompanies: Set<string>;       // companies where user has SAVED, lowercased
  // Populated after job IDs are known — one batch fetch per request
  scoreHistoryByJob: Map<string, { score: number }[]>; // jobId → entries ascending by createdAt
}

export async function fetchSignalsContext(userId: string): Promise<SignalsContext> {
  const [profile, actions] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { preferredCompanies: true },
    }),
    prisma.userJobAction.findMany({
      where: { userId, action: { in: ['SAVED', 'APPLIED'] } },
      select: { action: true, job: { select: { company: true } } },
    }),
  ]);

  const preferredCompanies = new Set(
    (profile?.preferredCompanies ?? []).map((c) => c.toLowerCase()),
  );

  const appliedCompanies = new Set<string>();
  const savedCompanies = new Set<string>();

  for (const a of actions) {
    const key = a.job.company.toLowerCase();
    if (a.action === 'APPLIED') appliedCompanies.add(key);
    else if (a.action === 'SAVED') savedCompanies.add(key);
  }

  return {
    preferredCompanies,
    appliedCompanies,
    savedCompanies,
    scoreHistoryByJob: new Map(), // populated after job IDs are known
  };
}

// ─── Computation ──────────────────────────────────────────────────────────────

const ROLE_OPEN_THRESHOLD_DAYS = 14;
const TREND_MIN_ENTRIES = 3;    // need at least 3 history points
const TREND_MIN_DELTA = 10;     // total rise must be ≥10 points to count

export function computeSignals(
  job: {
    id: string;
    company: string;
    postedAt: Date | string | null;
    scores: Array<{ score: number; previousScore?: number | null }>;
  },
  ctx: SignalsContext,
): OpportunitySignal[] {
  const signals: OpportunitySignal[] = [];
  const companyKey = job.company.toLowerCase();

  // preferred_company — on the user's watchlist
  if (ctx.preferredCompanies.has(companyKey)) {
    signals.push({ kind: 'preferred_company', label: 'Watchlist' });
  }

  // score_improved — score went up since last rescore
  const latestScore = job.scores[0];
  if (
    latestScore &&
    latestScore.previousScore != null &&
    latestScore.score > latestScore.previousScore
  ) {
    signals.push({
      kind: 'score_improved',
      label: `Score ↑ ${latestScore.previousScore}→${latestScore.score}`,
    });
  }

  // score_trending_up — score has risen monotonically over last 3 rescores with Δ≥10
  const history = ctx.scoreHistoryByJob.get(job.id) ?? [];
  if (history.length >= TREND_MIN_ENTRIES) {
    const recent = history.slice(-TREND_MIN_ENTRIES); // last 3 in ascending order
    const isMonotonic =
      recent[1].score > recent[0].score &&
      recent[2].score > recent[1].score;
    const totalDelta = recent[2].score - recent[0].score;
    if (isMonotonic && totalDelta >= TREND_MIN_DELTA) {
      signals.push({ kind: 'score_trending_up', label: `↑↑ Score rising` });
    }
  }

  // prior_interaction — saved/applied to another role at this company
  const hasApplied = ctx.appliedCompanies.has(companyKey);
  const hasSaved = ctx.savedCompanies.has(companyKey);
  if (hasApplied) {
    signals.push({ kind: 'prior_interaction', label: 'Applied here before' });
  } else if (hasSaved) {
    signals.push({ kind: 'prior_interaction', label: 'Saved here before' });
  }

  // role_open — role has been posted ≥14 days ago
  if (job.postedAt) {
    const days = Math.floor(
      (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days >= ROLE_OPEN_THRESHOLD_DAYS) {
      signals.push({ kind: 'role_open', label: `Open ${days}d` });
    }
  }

  return signals;
}
