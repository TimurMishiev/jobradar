import { prisma } from '../lib/prisma';
import { TARGET_COMPANIES, CompanyConfig, AtsType } from '../companies';
import { scoreNewJobs } from './scoring';
import { GreenhouseConnector } from '../connectors/greenhouse';
import { LeverConnector } from '../connectors/lever';
import { AshbyConnector } from '../connectors/ashby';
import { WorkdayConnector } from '../connectors/workday';
import { MetaConnector } from '../connectors/meta';
import { GoogleConnector } from '../connectors/google';
import { RawGreenhouseJob, RawLeverJob, RawAshbyJob, RawWorkdayJob, RawMetaJob, RawGoogleJob } from '../connectors/types';
import {
  normalizeGreenhouseJob,
  normalizeLeverJob,
  normalizeAshbyJob,
  normalizeWorkdayJob,
  normalizeMetaJob,
  normalizeGoogleJob,
  NormalizedJobInput,
} from './normalization';

export interface IngestionCompanyResult {
  company: string;
  fetched: number;
  created: number;
  error: string | null;
}

export interface IngestionSummary {
  startedAt: string;
  finishedAt: string;
  results: IngestionCompanyResult[];
  totalFetched: number;
  totalCreated: number;
}

// ─── Fetch raw jobs from the right connector ──────────────────────────────────

async function fetchAndNormalize(company: CompanyConfig): Promise<NormalizedJobInput[]> {
  switch (company.ats) {
    case 'greenhouse': {
      const connector = new GreenhouseConnector(company);
      const jobs = await connector.fetch() as RawGreenhouseJob[];
      return jobs.map((j) => normalizeGreenhouseJob(j, company));
    }
    case 'lever': {
      const connector = new LeverConnector(company);
      const jobs = await connector.fetch() as RawLeverJob[];
      return jobs.map((j) => normalizeLeverJob(j, company));
    }
    case 'ashby': {
      const connector = new AshbyConnector(company);
      const jobs = await connector.fetch() as RawAshbyJob[];
      return jobs.map((j) => normalizeAshbyJob(j, company));
    }
    case 'workday': {
      const connector = new WorkdayConnector(company);
      const jobs = await connector.fetch() as RawWorkdayJob[];
      return jobs.map((j) => normalizeWorkdayJob(j, company)).filter((j): j is NormalizedJobInput => j !== null);
    }
    case 'meta': {
      const connector = new MetaConnector(company);
      const jobs = await connector.fetch() as RawMetaJob[];
      return jobs.map((j) => normalizeMetaJob(j, company));
    }
    case 'google': {
      const connector = new GoogleConnector(company);
      const jobs = await connector.fetch() as RawGoogleJob[];
      return jobs.map((j) => normalizeGoogleJob(j, company));
    }
    default: {
      const _exhaustive: never = company.ats;
      throw new Error(`Unknown ATS type: ${_exhaustive}`);
    }
  }
}

// ─── Ingest a single company ──────────────────────────────────────────────────

async function ingestCompany(company: CompanyConfig): Promise<IngestionCompanyResult> {
  try {
    const normalizedJobs = await fetchAndNormalize(company);

    // createManyAndReturn returns the created records (skipping duplicates via @@unique constraint).
    // We use the returned IDs to trigger background scoring for new jobs with descriptions.
    const created = await prisma.job.createManyAndReturn({
      data: normalizedJobs,
      skipDuplicates: true,
      select: { id: true },
    });

    if (created.length > 0) {
      const newIds = created.map((j) => j.id);
      setImmediate(() => scoreNewJobs(newIds).catch(() => {}));
    }

    return {
      company: company.name,
      fetched: normalizedJobs.length,
      created: created.length,
      error: null,
    };
  } catch (err) {
    return {
      company: company.name,
      fetched: 0,
      created: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Main ingestion runner ────────────────────────────────────────────────────

export async function runIngestion(slugFilter?: string[]): Promise<IngestionSummary> {
  const startedAt = new Date().toISOString();

  const companies = slugFilter?.length
    ? TARGET_COMPANIES.filter((c) => slugFilter.includes(c.slug))
    : TARGET_COMPANIES;

  // Run companies sequentially — be a polite API consumer
  const results: IngestionCompanyResult[] = [];
  for (const company of companies) {
    process.stdout.write(
      `[ingestion] fetching ${company.name} (${company.ats})\n`,
    );
    const result = await ingestCompany(company);
    process.stdout.write(
      `[ingestion] ${company.name}: fetched=${result.fetched} created=${result.created}${result.error ? ` error=${result.error}` : ''}\n`,
    );
    results.push(result);
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    totalFetched: results.reduce((sum, r) => sum + r.fetched, 0),
    totalCreated: results.reduce((sum, r) => sum + r.created, 0),
  };
}
