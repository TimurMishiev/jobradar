import type { SeniorityLevel, RemoteType, EmploymentType } from '@jobradar/shared';
import { CompanyConfig } from '../companies';
import { RawGreenhouseJob, RawLeverJob, RawAshbyJob, RawWorkdayJob, RawMetaJob, RawGoogleJob } from '../connectors/types';
import { stripHtml } from '../lib/html';

function guessSeniority(title: string | null | undefined): SeniorityLevel {
  if (!title) return 'mid';
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

// ─── Workday ──────────────────────────────────────────────────────────────────

// Parse Workday's relative date strings into an absolute Date.
// Examples: "Posted Today", "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago"
function parseWorkdayPostedOn(value: string | null): Date | null {
  if (!value) return null;
  const v = value.toLowerCase();
  const now = new Date();
  if (v.includes('today')) {
    return now;
  }
  if (v.includes('yesterday')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  const match = v.match(/(\d+)\+?\s+day/);
  if (match) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(match[1], 10));
    return d;
  }
  return null;
}

export function normalizeWorkdayJob(
  job: RawWorkdayJob,
  company: CompanyConfig,
): NormalizedJobInput | null {
  // bulletFields[0] = requisitionId, bulletFields[1] = location (if present)
  const reqId = job.bulletFields?.[0] ?? '';
  const location = job.bulletFields?.[1] ?? null;
  // Use requisitionId as the stable external ID; fall back to externalPath slug
  const externalId = reqId || job.externalPath.split('_').pop() || job.externalPath.replace(/[^a-zA-Z0-9_-]/g, '-');
  // Public Workday URL includes language + board prefix: /en-US/{board}/job/...
  const url = `https://${company.workdayHost}/en-US/${company.workdayBoard}${job.externalPath}`;

  // Skip jobs with no title — these are partially-published internal roles
  if (!job.title) return null;

  return {
    sourceType: 'workday',
    sourceName: 'Workday',
    externalJobId: externalId,
    company: company.name,
    title: job.title,
    url,
    location,
    remoteType: normalizeRemoteType(location),
    descriptionRaw: null,
    descriptionNormalized: null,
    postedAt: parseWorkdayPostedOn(job.postedOn),
    tags: [],
    seniorityGuess: guessSeniority(job.title),
    employmentType: 'unknown',
    rawPayload: job,
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export function normalizeMetaJob(
  job: RawMetaJob,
  company: CompanyConfig,
): NormalizedJobInput {
  const tags = [job.team_title, ...(job.sub_teams ?? [])].filter((t): t is string => Boolean(t));

  return {
    sourceType: 'meta',
    sourceName: 'Meta Careers',
    externalJobId: job.id,
    company: company.name,
    title: job.title,
    url: job.url,
    location: job.locations?.[0] ?? null,
    remoteType: normalizeRemoteType(job.remote_type ?? job.locations?.[0]),
    descriptionRaw: null,
    descriptionNormalized: null,
    postedAt: job.post_date ? new Date(job.post_date) : null,
    tags,
    seniorityGuess: guessSeniority(job.title),
    employmentType: normalizeEmploymentType(job.type),
    rawPayload: job,
  };
}

// ─── Google ───────────────────────────────────────────────────────────────────

export function normalizeGoogleJob(
  job: RawGoogleJob,
  company: CompanyConfig,
): NormalizedJobInput {
  // 'jobs/12345' → '12345'
  const externalId = job.name.split('/').pop() ?? job.name;
  const url = job.applicationInfo?.uris?.[0] ?? `https://careers.google.com/jobs/results/${externalId}/`;
  const location = job.locations?.[0]?.display ?? null;
  const description = [job.description, job.responsibilities, job.qualifications]
    .filter(Boolean)
    .join('\n\n') || null;

  return {
    sourceType: 'google',
    sourceName: 'Google Careers',
    externalJobId: externalId,
    company: company.name,
    title: job.title,
    url,
    location,
    remoteType: normalizeRemoteType(location),
    descriptionRaw: description,
    descriptionNormalized: description ? stripHtml(description) : null,
    postedAt: job.publishTime ? new Date(job.publishTime) : null,
    tags: job.categories ?? [],
    seniorityGuess: guessSeniority(job.title),
    employmentType: 'full_time', // Google Careers only lists full-time roles
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
