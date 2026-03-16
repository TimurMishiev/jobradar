import { CompanyConfig } from '../companies';
import { RawMetaJob } from './types';

const GRAPHQL_URL = 'https://www.metacareers.com/graphql';
const FETCH_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 25;
const MAX_JOBS = 500;

// Meta compiles their GraphQL queries server-side and exposes them by doc_id.
// This ID rotates and requires JavaScript execution to discover reliably.
// Until Playwright scraping is added, this connector will fail gracefully.
// To update: open metacareers.com/jobs/ in DevTools → Network → find the /graphql
// request and copy the doc_id from its form body.
// Last verified: 2026-03-16 (7389006774460820 — no longer valid)
const JOBS_DOC_ID = '7389006774460820';

interface MetaSearchInput {
  q: string;
  teams: string[];
  offices: string[];
  roles: string[];
  leadership_levels: string[];
  results_per_page: number;
  page: number;
  sort_by_new: boolean;
  is_leadership: boolean;
  is_remote_only: boolean;
  social_impact_categories: string[];
}

interface MetaJobSearchResponse {
  data?: {
    job_search?: {
      results?: RawMetaJob[];
      count?: number;
    };
  };
  errors?: Array<{ message: string }>;
}

export class MetaConnector {
  constructor(private company: CompanyConfig) {}

  async fetch(): Promise<RawMetaJob[]> {
    const all: RawMetaJob[] = [];
    let page = 1;
    let total = Infinity;

    while (all.length < total && all.length < MAX_JOBS) {
      const batch = await this.fetchPage(page);
      if (total === Infinity) total = batch.count;
      all.push(...batch.results);
      page++;
      if (batch.results.length < PAGE_SIZE) break;
    }

    return all.slice(0, MAX_JOBS);
  }

  private async fetchPage(page: number): Promise<{ results: RawMetaJob[]; count: number }> {
    const variables: MetaSearchInput = {
      q: '',
      teams: [],
      offices: [],
      roles: [],
      leadership_levels: [],
      results_per_page: PAGE_SIZE,
      page,
      sort_by_new: true,
      is_leadership: false,
      is_remote_only: false,
      social_impact_categories: [],
    };

    const body = new URLSearchParams({
      variables: JSON.stringify({ search_input: variables }),
      doc_id: JOBS_DOC_ID,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Origin': 'https://www.metacareers.com',
          'Referer': 'https://www.metacareers.com/jobs/',
        },
        body: body.toString(),
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(
        `Meta network error: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(
        `Meta GraphQL request failed: ${res.status} ${res.statusText} — doc_id may need updating`,
      );
    }

    let data: MetaJobSearchResponse;
    try {
      data = (await res.json()) as MetaJobSearchResponse;
    } catch {
      throw new Error('Meta returned invalid JSON — page structure may have changed');
    }

    if (data.errors?.length) {
      throw new Error(`Meta GraphQL error: ${data.errors[0].message}`);
    }

    const results = data.data?.job_search?.results ?? [];
    const count = data.data?.job_search?.count ?? results.length;

    return { results, count };
  }
}
