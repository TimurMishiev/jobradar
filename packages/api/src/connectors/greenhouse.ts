import { CompanyConfig } from '../companies';
import { GreenhouseBoardResponse, RawGreenhouseJob } from './types';

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';
const FETCH_TIMEOUT_MS = 15_000;

export class GreenhouseConnector {
  constructor(private company: CompanyConfig) {}

  async fetch(): Promise<RawGreenhouseJob[]> {
    const url = `${BASE_URL}/${this.company.boardToken}/jobs?content=true`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      throw new Error(
        `Greenhouse network error for ${this.company.name}: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(
        `Greenhouse fetch failed for ${this.company.name}: ${res.status} ${res.statusText}`,
      );
    }

    let data: GreenhouseBoardResponse;
    try {
      data = (await res.json()) as GreenhouseBoardResponse;
    } catch {
      throw new Error(`Greenhouse returned invalid JSON for ${this.company.name}`);
    }

    return data.jobs ?? [];
  }
}
