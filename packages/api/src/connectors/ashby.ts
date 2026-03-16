import { CompanyConfig } from '../companies';
import { AshbyBoardResponse, RawAshbyJob } from './types';

const BASE_URL = 'https://api.ashbyhq.com/posting-api/job-board';
const FETCH_TIMEOUT_MS = 15_000;

export class AshbyConnector {
  constructor(private company: CompanyConfig) {}

  async fetch(): Promise<RawAshbyJob[]> {
    const url = `${BASE_URL}/${this.company.boardToken}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      throw new Error(
        `Ashby network error for ${this.company.name}: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(
        `Ashby fetch failed for ${this.company.name}: ${res.status} ${res.statusText}`,
      );
    }

    let data: AshbyBoardResponse;
    try {
      data = (await res.json()) as AshbyBoardResponse;
    } catch {
      throw new Error(`Ashby returned invalid JSON for ${this.company.name}`);
    }

    // Only return publicly listed jobs
    return (data.jobs ?? []).filter((job) => job.isListed);
  }
}
