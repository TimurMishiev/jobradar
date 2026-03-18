// ─── Daily Briefing ───────────────────────────────────────────────────────────

export interface BriefingTopPick {
  jobId: string;
  title: string;
  company: string;
  score: number;
  reason: string;
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

// ─── Gap Analysis ─────────────────────────────────────────────────────────────

export interface SkillGap {
  skill: string;
  count: number;
  context: string;
}

export interface GapAnalysisPayload {
  summary: string;
  topGaps: SkillGap[];
  recommendation: string;
  basedOnJobCount: number;
  minScore: number;
}

// ─── Company Signals ──────────────────────────────────────────────────────────

export type CompanySignalKind = 'HIRING_CLUSTER' | 'SKILL_MATCH_CLUSTER';

export interface CompanySignal {
  company: string;
  kind: CompanySignalKind;
  description: string;
  roleCount: number;
  topRole: string | null;
}

export interface CompanySignalsPayload {
  signals: CompanySignal[];
  generatedAt: string;
  basedOnDays: number;
}
