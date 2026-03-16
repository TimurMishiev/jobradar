import { CompanyConfig } from '../companies';
import { RawLeverJob } from './types';

const BASE_URL = 'https://api.lever.co/v0/postings';
const FETCH_TIMEOUT_MS = 15_000;

export class LeverConnector {
  constructor(private company: CompanyConfig) {}

  async fetch(): Promise<RawLeverJob[]> {
    const url = `${BASE_URL}/${this.company.boardToken}?mode=json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      throw new Error(
        `Lever network error for ${this.company.name}: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(
        `Lever fetch failed for ${this.company.name}: ${res.status} ${res.statusText}`,
      );
    }

    let data: RawLeverJob[];
    try {
      data = (await res.json()) as RawLeverJob[];
    } catch {
      throw new Error(`Lever returned invalid JSON for ${this.company.name}`);
    }

    return data ?? [];
  }
}
