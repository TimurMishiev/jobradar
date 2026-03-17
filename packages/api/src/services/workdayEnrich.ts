import { prisma } from '../lib/prisma';
import { TARGET_COMPANIES } from '../companies';
import { stripHtml } from '../lib/html';

const FETCH_TIMEOUT_MS = 15_000;

interface WorkdayDetailResponse {
  jobPostingInfo?: {
    jobDescription?: string;
    timeType?: string;
    location?: string;
  };
}

// Enrich descriptions for all Workday jobs that don't have one yet.
// Runs in the background after ingestion; processes most-recent-first, capped per run.
export async function bulkEnrichWorkdayJobs(limit = 100): Promise<void> {
  const jobs = await prisma.job.findMany({
    where: { sourceType: 'workday', isActive: true, descriptionNormalized: null },
    select: { id: true },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });

  for (const job of jobs) {
    try {
      await enrichWorkdayJob(job.id);
    } catch (err) {
      console.error(`[workday] bulk enrich failed ${job.id}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

// Fetch description for a single Workday job and persist it to the DB.
// Called lazily on first job detail open; no-ops if description already present.
export async function enrichWorkdayJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { sourceType: true, externalJobId: true, url: true, descriptionNormalized: true, employmentType: true, company: true },
  });

  if (!job || job.sourceType !== 'workday' || job.descriptionNormalized) return;

  // Find the company config matching this specific job's company name
  const company = TARGET_COMPANIES.find(
    (c) => c.ats === 'workday' && c.name.toLowerCase() === job.company.toLowerCase(),
  );
  if (!company?.workdayHost || !company?.workdayBoard) return;

  // Extract the /job/... portion from the URL.
  // URL format: https://host/en-US/Board/job/City/Title_Rid (new) or https://host/job/... (old)
  let externalPath: string;
  try {
    const pathname = new URL(job.url).pathname;
    const jobIdx = pathname.indexOf('/job/');
    externalPath = jobIdx !== -1 ? pathname.slice(jobIdx) : pathname;
  } catch {
    return;
  }

  const detailUrl = `https://${company.workdayHost}/wday/cxs/${company.boardToken}/${company.workdayBoard}${externalPath}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let data: WorkdayDetailResponse;
  try {
    const res = await fetch(detailUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': `https://${company.workdayHost}/en-US/${company.workdayBoard}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) return;
    data = (await res.json()) as WorkdayDetailResponse;
  } catch {
    return;
  } finally {
    clearTimeout(timer);
  }

  const info = data.jobPostingInfo;
  if (!info?.jobDescription) return;

  const updates: Record<string, string> = {
    descriptionRaw: info.jobDescription,
    descriptionNormalized: stripHtml(info.jobDescription),
  };

  // Also backfill employmentType if it was unknown and Workday provides timeType
  if (job.employmentType === 'unknown' && info.timeType) {
    const t = info.timeType.toLowerCase().replace(/[- _]/g, '');
    if (t.includes('fulltime') || t === 'full') updates.employmentType = 'full_time';
    else if (t.includes('parttime') || t === 'part') updates.employmentType = 'part_time';
  }

  await prisma.job.update({ where: { id: jobId }, data: updates });
}
