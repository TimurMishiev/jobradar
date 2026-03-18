import type { NormalizedJob } from '@jobradar/shared';

// Re-export shared payload types so the rest of the web codebase imports from one place
export type {
  DailyBriefingPayload,
  BriefingTopPick,
  WatchlistHighlight,
  GapAnalysisPayload,
  SkillGap,
  CompanySignalKind,
  CompanySignal,
  CompanySignalsPayload,
} from '@jobradar/shared';

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

export interface BriefingInsightResponse {
  id: string;
  generatedAt: string;
  payload: import('@jobradar/shared').DailyBriefingPayload;
}

export interface GapAnalysisInsightResponse {
  id: string;
  generatedAt: string;
  payload: import('@jobradar/shared').GapAnalysisPayload;
}

export interface CompanySignalsInsightResponse {
  id: string;
  generatedAt: string;
  payload: import('@jobradar/shared').CompanySignalsPayload;
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
