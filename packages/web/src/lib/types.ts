import type { NormalizedJob } from '@jobradar/shared';

export type JobAction = 'SAVED' | 'IGNORED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
export type TrackerStage = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';

export interface UserJobAction {
  id: string;
  userId: string;
  jobId: string;
  action: JobAction;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobScore {
  id: string;
  jobId: string;
  resumeId: string | null;
  score: number;
  previousScore: number | null;
  fitCategory: 'high' | 'medium' | 'low' | null;
  summary: string | null;
  matchReasons: string[];
  missingSignals: string[];
  modelUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OpportunitySignalKind =
  | 'preferred_company'
  | 'score_improved'
  | 'score_trending_up'
  | 'prior_interaction'
  | 'role_open';

export interface OpportunitySignal {
  kind: OpportunitySignalKind;
  label: string;
}

// What the jobs list and detail endpoints actually return
export interface JobWithDetails extends NormalizedJob {
  scores: JobScore[];
  userActions: UserJobAction[];
  opportunitySignals: OpportunitySignal[];
}

export interface Resume {
  id: string;
  label: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedSkills: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface BriefingInsightResponse {
  id: string;
  generatedAt: string;
  payload: DailyBriefingPayload;
}

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

export interface GapAnalysisInsightResponse {
  id: string;
  generatedAt: string;
  payload: GapAnalysisPayload;
}

export interface DigestResponse {
  generatedAt: string;
  topScored: JobWithDetails[];
  newToday: JobWithDetails[];
  watchlist: JobWithDetails[];
}

export interface JobFeedResponse {
  data: JobWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
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

export interface CompanySignalsInsightResponse {
  id: string;
  generatedAt: string;
  payload: CompanySignalsPayload;
}

// ─── Insight Timeline ─────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  type: string;
  generatedAt: string;
  payload: unknown;
}

export interface InsightTimelineResponse {
  data: TimelineEntry[];
}
