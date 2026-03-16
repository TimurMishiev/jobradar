import type { SeniorityLevel, RemoteType, EmploymentType } from '@signalhire/shared';
import { CompanyConfig } from '../companies';
import { RawGreenhouseJob, RawLeverJob, RawAshbyJob } from '../connectors/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return (
    html
      // Greenhouse sends entity-encoded HTML — decode tag boundaries first so the
      // regex can see actual < > characters, then strip.
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // Strip all HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode remaining entities
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function guessSeniority(title: string): SeniorityLevel {
  const t = title.toLowerCase();
  if (/\bintern\b/.test(t)) return 'intern';
  if (/\bjr\.?\b|\bjunior\b/.test(t)) return 'junior';
  if (/\bprincipal\b/.test(t)) return 'principal';
  if (/\bstaff\b/.test(t)) return 'staff';
  if (/\bsr\.?\b|\bsenior\b/.test(t)) return 'senior';
  if (/\bdirector\b/.test(t)) return 'director';
  if (/\bmanager\b|\bmgr\b/.test(t)) return 'manager';
  return 'mid';
}

function normalizeRemoteType(value: string | null | undefined): RemoteType {
  if (!value) return 'unknown';
  const v = value.toLowerCase();
  if (v.includes('remote') && !v.includes('hybrid')) return 'remote';
  if (v.includes('hybrid')) return 'hybrid';
  if (v.includes('on-site') || v.includes('onsite') || v.includes('in-office') || v.includes('in office')) return 'onsite';
  return 'unknown';
}

function normalizeEmploymentType(value: string | null | undefined): EmploymentType {
  if (!value) return 'unknown';
  const v = value.toLowerCase().replace(/[- _]/g, '');
  if (v.includes('fulltime') || v === 'full') return 'full_time';
  if (v.includes('parttime') || v === 'part') return 'part_time';
  if (v.includes('contract')) return 'contract';
  if (v.includes('intern')) return 'internship';
  return 'unknown';
}

// ─── Normalized job shape used for DB inserts ─────────────────────────────────
// Matches Prisma Job model fields (minus id, createdAt, updatedAt which are auto-set).

export interface NormalizedJobInput {
  sourceType: string;
  sourceName: string;
  externalJobId: string;
  company: string;
  title: string;
  url: string;
  location: string | null;
  remoteType: string;
  descriptionRaw: string | null;
  descriptionNormalized: string | null;
  postedAt: Date | null;
  tags: string[];
  seniorityGuess: string;
  employmentType: string;
  rawPayload: object;
}

// ─── Greenhouse ───────────────────────────────────────────────────────────────

export function normalizeGreenhouseJob(
  job: RawGreenhouseJob,
  company: CompanyConfig,
): NormalizedJobInput {
  const location = job.location?.name ?? null;
  const tags = job.departments?.map((d) => d.name).filter(Boolean) ?? [];

  return {
    sourceType: 'greenhouse',
    sourceName: 'Greenhouse',
    externalJobId: String(job.id),
    company: company.name,
    title: job.title,
    url: job.absolute_url,
    location,
    remoteType: normalizeRemoteType(location),
    descriptionRaw: job.content ?? null,
    descriptionNormalized: job.content ? stripHtml(job.content) : null,
    postedAt: job.first_published ? new Date(job.first_published) : null,
    tags,
    seniorityGuess: guessSeniority(job.title),
    employmentType: 'unknown', // not available in Greenhouse list endpoint
    rawPayload: job,
  };
}

// ─── Lever ────────────────────────────────────────────────────────────────────

export function normalizeLeverJob(
  job: RawLeverJob,
  company: CompanyConfig,
): NormalizedJobInput {
  const location = job.categories?.location ?? null;
  const tags = [job.categories?.team, job.categories?.department]
    .filter((t): t is string => Boolean(t));

  return {
    sourceType: 'lever',
    sourceName: 'Lever',
    externalJobId: job.id,
    company: company.name,
    title: job.text,
    url: job.hostedUrl,
    location,
    remoteType: normalizeRemoteType(job.workplaceType ?? location),
    descriptionRaw: job.descriptionPlain ?? null,
    descriptionNormalized: job.descriptionPlain ?? null,
    postedAt: job.createdAt ? new Date(job.createdAt) : null,
    tags,
    seniorityGuess: guessSeniority(job.text),
    employmentType: normalizeEmploymentType(job.categories?.commitment),
    rawPayload: job,
  };
}

// ─── Ashby ────────────────────────────────────────────────────────────────────

export function normalizeAshbyJob(
  job: RawAshbyJob,
  company: CompanyConfig,
): NormalizedJobInput {
  const tags = [job.department, job.team].filter((t): t is string => Boolean(t));

  return {
    sourceType: 'ashby',
    sourceName: 'Ashby',
    externalJobId: job.id,
    company: company.name,
    title: job.title,
    url: job.jobUrl,
    location: job.location ?? null,
    remoteType: normalizeRemoteType(job.workplaceType ?? (job.isRemote ? 'remote' : null)),
    descriptionRaw: job.descriptionPlain ?? null,
    descriptionNormalized: job.descriptionPlain ?? null,
    postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    tags,
    seniorityGuess: guessSeniority(job.title),
    employmentType: normalizeEmploymentType(job.employmentType),
    rawPayload: job,
  };
}
