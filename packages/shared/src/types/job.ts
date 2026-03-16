import type { JobScoreResult } from './scoring';

export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export type SeniorityLevel =
  | 'intern'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'staff'
  | 'principal'
  | 'manager'
  | 'director'
  | 'unknown';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'unknown';

export type JobActionType = 'saved' | 'ignored' | 'applied';

export interface NormalizedJob {
  id: string;
  sourceType: string;
  sourceName: string;
  externalJobId: string | null;
  company: string;
  title: string;
  url: string;
  location: string | null;
  remoteType: RemoteType;
  descriptionRaw: string | null;
  descriptionNormalized: string | null;
  postedAt: string | null; // ISO date string
  fetchedAt: string;
  tags: string[];
  seniorityGuess: SeniorityLevel;
  employmentType: EmploymentType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobWithScore extends NormalizedJob {
  score: JobScoreResult | null;
  userAction: JobActionType | null;
}
