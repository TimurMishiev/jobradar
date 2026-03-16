export type FitCategory = 'high' | 'medium' | 'low';

export interface SkillsMatch {
  matched: string[];   // skills in both job and user profile
  missing: string[];   // skills required by job that user lacks
  bonus: string[];     // skills user has that are nice-to-have
}

export interface JobScoreResult {
  id: string;
  jobId: string;
  resumeId: string | null;
  score: number;       // 0–100
  fitCategory: FitCategory;
  explanation: string | null;
  skillsMatch: SkillsMatch | null;
  modelUsed: string | null;
  createdAt: string;
}

// Sent from API → scoring service
export interface ScoringRequest {
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  company: string;
  resumeText: string;
  userProfile: {
    targetTitles: string[];
    targetSkills: string[];
    preferredCompanies: string[];
  };
}

// Returned from AI layer → scoring service
export interface ScoringResponse {
  score: number;
  fitCategory: FitCategory;
  explanation: string;
  skillsMatch: SkillsMatch;
}
