import { CompanyConfig } from '../companies';
import { RawWorkdayJob, WorkdayResponse } from './types';

const FETCH_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 20; // Workday CXS API rejects limit > 20
// Cap total results per run to avoid hammering — Accenture has thousands of jobs
const MAX_JOBS = 500;

export class WorkdayConnector {
  constructor(private company: CompanyConfig) {
    if (!company.workdayHost || !company.workdayBoard) {
      throw new Error(
        `WorkdayConnector requires workdayHost and workdayBoard on ${company.name}`,
      );
    }
  }

  private get baseUrl(): string {
    const { workdayHost, boardToken, workdayBoard } = this.company;
    return `https://${workdayHost}/wday/cxs/${boardToken}/${workdayBoard}/jobs`;
  }

  async fetch(): Promise<RawWorkdayJob[]> {
    const all: RawWorkdayJob[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total && all.length < MAX_JOBS) {
      const batch = await this.fetchPage(offset);
      if (total === Infinity) total = batch.total;
      all.push(...batch.jobPostings);
      offset += PAGE_SIZE;
      if (batch.jobPostings.length < PAGE_SIZE) break;
    }

    return all.slice(0, MAX_JOBS);
  }

  private async fetchPage(offset: number): Promise<WorkdayResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Origin': `https://${this.company.workdayHost}`,
          'Referer': `https://${this.company.workdayHost}/en-US/${this.company.workdayBoard}`,
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: PAGE_SIZE,
          offset,
          searchText: '',
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(
        `Workday network error for ${this.company.name}: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(
        `Workday fetch failed for ${this.company.name}: ${res.status} ${res.statusText}`,
      );
    }

    let data: WorkdayResponse;
    try {
      data = (await res.json()) as WorkdayResponse;
    } catch {
      throw new Error(`Workday returned invalid JSON for ${this.company.name}`);
    }

    return { total: data.total ?? 0, jobPostings: data.jobPostings ?? [] };
  }
}
