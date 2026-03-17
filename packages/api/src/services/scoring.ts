import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';

const MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 30_000;
const PREFERRED_COMPANY_BOOST = 5;

interface ScoringOutput {
  score: number;
  matchReasons: string[];
  missingSignals: string[];
  summary: string;
}

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: key });
}

function buildPrompt(params: {
  jobTitle: string;
  company: string;
  description: string;
  targetTitles: string[];
  targetSkills: string[];
  resumeText: string | null;
  isPreferredCompany: boolean;
}): string {
  const { jobTitle, company, description, targetTitles, targetSkills, resumeText, isPreferredCompany } = params;

  const profileSection = [
    targetTitles.length > 0 ? `Target titles: ${targetTitles.join(', ')}` : null,
    targetSkills.length > 0 ? `Target skills: ${targetSkills.join(', ')}` : null,
    isPreferredCompany ? `Note: ${company} is a preferred company for this candidate.` : null,
    resumeText ? `\nResume:\n${resumeText.slice(0, 3000)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `You are a job-fit analyzer. Given a candidate profile and a job posting, return a JSON object scoring how well the candidate fits.

Candidate profile:
${profileSection || 'No profile provided.'}

Job posting:
Company: ${company}
Title: ${jobTitle}
Description:
${description.slice(0, 4000)}

Return ONLY valid JSON with this exact shape:
{
  "score": <integer 0-100>,
  "matchReasons": [<2-4 concise bullet strings explaining why this is a good fit>],
  "missingSignals": [<0-3 concise bullet strings for skills/experience the job requires that the candidate lacks>],
  "summary": <1-2 sentence plain-English summary of the overall fit>
}

Guidelines:
- score 75-100 = strong fit, 45-74 = moderate fit, 0-44 = weak fit
- matchReasons should be specific (mention actual skills/experience overlap), not generic
- missingSignals should only list genuine gaps, not minor nice-to-haves — return [] if none
- summary must be concrete and actionable, not vague`;
}

export async function scoreJob(jobId: string): Promise<{
  id: string;
  jobId: string;
  resumeId: string | null;
  score: number;
  fitCategory: string | null;
  matchReasons: string[];
  missingSignals: string[];
  summary: string | null;
  modelUsed: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  const client = getClient();

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found');

  const user = await getLocalUser();
  if (!user) throw new Error('No user found — run a profile setup first');

  const [profile, resume] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.resume.findFirst({ where: { userId: user.id, isDefault: true } }),
  ]);

  const isPreferredCompany = profile?.preferredCompanies.some(
    (c) => c.toLowerCase() === job.company.toLowerCase(),
  ) ?? false;

  const prompt = buildPrompt({
    jobTitle: job.title,
    company: job.company,
    description: job.descriptionNormalized ?? job.descriptionRaw ?? '',
    targetTitles: profile?.targetTitles ?? [],
    targetSkills: profile?.targetSkills ?? [],
    resumeText: resume?.textContent ?? null,
    isPreferredCompany,
  });

  const completion = await client.chat.completions.create(
    {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    },
    { signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS) },
  );

  const raw = completion.choices[0]?.message?.content ?? '{}';

  let output: ScoringOutput;
  try {
    output = JSON.parse(raw) as ScoringOutput;
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Clamp score; apply preferred company boost
  const rawScore = Number(output.score);
  let score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  if (isPreferredCompany) score = Math.min(100, score + PREFERRED_COMPANY_BOOST);

  const fitCategory = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';

  const matchReasons = Array.isArray(output.matchReasons)
    ? output.matchReasons.filter((r): r is string => typeof r === 'string').slice(0, 6)
    : [];
  const missingSignals = Array.isArray(output.missingSignals)
    ? output.missingSignals.filter((r): r is string => typeof r === 'string').slice(0, 4)
    : [];
  const summary = typeof output.summary === 'string' ? output.summary : null;

  const scoreData = {
    score,
    fitCategory,
    explanation: summary,           // keep legacy field in sync
    skillsMatch: Prisma.JsonNull,   // legacy field no longer populated
    matchReasons,
    missingSignals,
    summary,
    modelUsed: MODEL,
  };

  // NULL != NULL in SQL unique constraints — handle resumeId null case explicitly
  let result;
  if (resume) {
    result = await prisma.jobScore.upsert({
      where: { jobId_resumeId: { jobId, resumeId: resume.id } },
      create: { jobId, resumeId: resume.id, ...scoreData },
      update: scoreData,
    });
  } else {
    const existing = await prisma.jobScore.findFirst({ where: { jobId, resumeId: null } });
    if (existing) {
      result = await prisma.jobScore.update({ where: { id: existing.id }, data: scoreData });
    } else {
      result = await prisma.jobScore.create({ data: { jobId, resumeId: null, ...scoreData } });
    }
  }

  return result;
}

// Score all jobs that have a description but no score yet.
// Runs in the background — callers should not await this.
export async function scoreUnscoredJobs(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;

  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      descriptionNormalized: { not: null },
      scores: { none: {} },
    },
    select: { id: true },
    orderBy: { postedAt: 'desc' },
    take: 50,
  });

  for (const job of jobs) {
    try {
      await scoreJob(job.id);
    } catch {
      // Individual failures are non-fatal — continue scoring the rest
    }
  }
}

// Rescore ALL jobs with descriptions — used when profile or resume changes significantly.
// Scores most recent jobs first; no cap.
export async function rescoreAllJobs(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return;

  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      descriptionNormalized: { not: null },
    },
    select: { id: true },
    orderBy: { postedAt: 'desc' },
  });

  for (const job of jobs) {
    try {
      await scoreJob(job.id);
    } catch {
      // Individual failures are non-fatal
    }
  }
}

// Score a specific set of newly ingested job IDs that have descriptions.
export async function scoreNewJobs(jobIds: string[]): Promise<void> {
  if (!process.env.OPENAI_API_KEY || jobIds.length === 0) return;

  const jobs = await prisma.job.findMany({
    where: {
      id: { in: jobIds },
      descriptionNormalized: { not: null },
      scores: { none: {} },
    },
    select: { id: true },
  });

  for (const job of jobs) {
    try {
      await scoreJob(job.id);
    } catch {
      // Non-fatal
    }
  }
}
