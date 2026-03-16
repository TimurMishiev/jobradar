import { CompanyConfig } from '../companies';
import { RawGoogleJob } from './types';

// NOTE: Google Careers has no public JSON API. This endpoint returns 404.
// Proper scraping requires a headless browser (Playwright) to execute JavaScript
// and extract jobs from the SPA at https://www.google.com/about/careers/applications/
// Until then, this connector will fail gracefully and log a clear error.
const SEARCH_URL = 'https://www.google.com/about/careers/applications/api/v3/search/';
const FETCH_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 100;
const MAX_JOBS = 500;

interface GoogleSearchResponse {
  jobs?: RawGoogleJob[];
  nextPageToken?: string;
}

export class GoogleConnector {
  constructor(private company: CompanyConfig) {}

  async fetch(): Promise<RawGoogleJob[]> {
    const all: RawGoogleJob[] = [];
    let pageToken: string | undefined;

    do {
      const batch = await this.fetchPage(pageToken);
      all.push(...batch.jobs);
      pageToken = batch.nextPageToken;
    } while (pageToken && all.length < MAX_JOBS);

    return all.slice(0, MAX_JOBS);
  }

  private async fetchPage(pageToken?: string): Promise<{ jobs: RawGoogleJob[]; nextPageToken?: string }> {
    const params = new URLSearchParams({
      company: 'Google',
      hl: 'en_US',
      jlo: 'en_US',
      q: '',
      sort_by: 'date',
      page_size: String(PAGE_SIZE),
    });
    if (pageToken) params.set('page_token', pageToken);

    const url = `${SEARCH_URL}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; JobRadar/1.0)',
          'Referer': 'https://careers.google.com/',
        },
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(
        `Google Careers network error: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(
        `Google Careers fetch failed: ${res.status} ${res.statusText}`,
      );
    }

    let data: GoogleSearchResponse;
    try {
      data = (await res.json()) as GoogleSearchResponse;
    } catch {
      throw new Error('Google Careers returned invalid JSON — API may have changed');
    }

    return {
      jobs: data.jobs ?? [],
      nextPageToken: data.nextPageToken,
    };
  }
}
