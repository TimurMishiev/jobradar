import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

const MODEL = 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = 20_000;
const MAX_RESUME_CHARS = 6_000; // enough to capture skills without burning tokens on full resume
const MAX_SKILLS = 40;

// Extract technical skills from a resume's text content and persist them.
// No-ops if OPENAI_API_KEY is missing, textContent is absent, or skills already extracted.
// Safe to call multiple times — idempotent by the re-extraction check.
export async function extractSkillsFromResume(
  resumeId: string,
  { force = false }: { force?: boolean } = {},
): Promise<string[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    select: { textContent: true, extractedSkills: true },
  });

  if (!resume?.textContent) return [];
  if (!force && resume.extractedSkills.length > 0) return resume.extractedSkills;

  const client = new OpenAI({ apiKey: key });

  const prompt = `Extract all technical skills, tools, frameworks, libraries, programming languages, and platforms mentioned in this resume. Do not include soft skills, job titles, company names, or education degrees.

Resume text:
${resume.textContent.slice(0, MAX_RESUME_CHARS)}

Return ONLY valid JSON:
{ "skills": ["<skill1>", "<skill2>", ...] }

Rules:
- Use canonical names (e.g. "TypeScript" not "typescript", "React.js" → "React")
- Include specific tools (e.g. "Docker", "PostgreSQL", "AWS S3")
- Up to ${MAX_SKILLS} skills, ordered by prominence in the resume
- No duplicates`;

  const completion = await client.chat.completions.create(
    {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // low temperature — this is extraction, not creative reasoning
    },
    { signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS) },
  );

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let skills: string[] = [];
  try {
    const parsed = JSON.parse(raw) as { skills?: unknown };
    skills = Array.isArray(parsed.skills)
      ? parsed.skills.filter((s): s is string => typeof s === 'string').slice(0, MAX_SKILLS)
      : [];
  } catch {
    console.error('[resumeSkills] Failed to parse GPT response:', raw.slice(0, 200));
    return [];
  }

  await prisma.resume.update({
    where: { id: resumeId },
    data: { extractedSkills: skills },
  });

  return skills;
}
