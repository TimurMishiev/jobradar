import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { getLocalUser } from '../lib/user';

const MODEL = 'gpt-4o-mini';

interface ScoringOutput {
  score: number;
  fitCategory: 'high' | 'medium' | 'low';
  explanation: string;
  skillsMatch: {
    matched: string[];
    missing: string[];
    bonus: string[];
  };
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
}): string {
  const { jobTitle, company, description, targetTitles, targetSkills, resumeText } = params;

  const profileSection = [
    targetTitles.length > 0 ? `Target titles: ${targetTitles.join(', ')}` : null,
    targetSkills.length > 0 ? `Target skills: ${targetSkills.join(', ')}` : null,
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
  "fitCategory": <"high" | "medium" | "low">,
  "explanation": <1-2 sentence summary of the match>,
  "skillsMatch": {
    "matched": [<skills present in both candidate and job>],
    "missing": [<skills required by job that candidate lacks>],
    "bonus": [<candidate skills not required but relevant>]
  }
}

Guidelines:
- score 75-100 = high fit, 45-74 = medium fit, 0-44 = low fit
- fitCategory must match the score range
- Keep explanation concise and specific`;
}

export async function scoreJob(jobId: string): Promise<{
  id: string;
  jobId: string;
  resumeId: string | null;
  score: number;
  fitCategory: string | null;
  explanation: string | null;
  skillsMatch: unknown;
  modelUsed: string | null;
  createdAt: Date;
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

  const prompt = buildPrompt({
    jobTitle: job.title,
    company: job.company,
    description: job.descriptionNormalized ?? job.descriptionRaw ?? '',
    targetTitles: profile?.targetTitles ?? [],
    targetSkills: profile?.targetSkills ?? [],
    resumeText: resume?.textContent ?? null,
  });

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';

  let output: ScoringOutput;
  try {
    output = JSON.parse(raw) as ScoringOutput;
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Clamp score to 0-100
  const score = Math.max(0, Math.min(100, Math.round(output.score ?? 0)));
  const fitCategory =
    ['high', 'medium', 'low'].includes(output.fitCategory) ? output.fitCategory : null;

  const scoreData = {
    score,
    fitCategory,
    explanation: output.explanation ?? null,
    skillsMatch: output.skillsMatch ?? null,
    modelUsed: MODEL,
  };

  // NULL != NULL in SQL unique constraints, so upsert via the composite key only
  // works when resumeId is non-null. Handle both cases explicitly.
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
