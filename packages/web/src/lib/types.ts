import type { NormalizedJob } from '@jobradar/shared';

export type JobAction = 'SAVED' | 'IGNORED' | 'APPLIED';

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
  fitCategory: 'high' | 'medium' | 'low' | null;
  explanation: string | null;
  skillsMatch: {
    matched: string[];
    missing: string[];
    bonus: string[];
  } | null;
  modelUsed: string | null;
  createdAt: string;
}

// What the jobs list and detail endpoints actually return
export interface JobWithDetails extends NormalizedJob {
  scores: JobScore[];
  userActions: UserJobAction[];
}

export interface Resume {
  id: string;
  label: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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
