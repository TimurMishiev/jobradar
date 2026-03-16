// ─── Raw Greenhouse job shape ─────────────────────────────────────────────────

export interface RawGreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  content: string;                           // HTML description
  departments: Array<{ id: number; name: string }>;
  offices: Array<{ id: number; name: string; location: string }>;
  first_published: string | null;
  updated_at: string;
  company_name: string;
  internal_job_id: number;
  requisition_id: string | null;
  metadata: unknown[];
}

export interface GreenhouseBoardResponse {
  jobs: RawGreenhouseJob[];
}

// ─── Raw Lever job shape ──────────────────────────────────────────────────────

export interface RawLeverJob {
  id: string;
  text: string;                              // title
  hostedUrl: string;
  applyUrl: string;
  categories: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;                     // Full-time, Part-time, Contract, etc.
    level?: string;
  };
  description: string;                       // HTML
  descriptionPlain: string;
  lists: Array<{ text: string; content: string }>;
  additional: string;
  additionalPlain: string;
  createdAt: number;                         // ms timestamp
  workplaceType?: string;                    // remote | hybrid | on-site
}

// ─── Raw Ashby job shape ──────────────────────────────────────────────────────

export interface RawAshbyJob {
  id: string;
  title: string;
  department: string;
  team: string;
  employmentType: string;                    // FullTime, PartTime, Contract, Internship
  location: string;
  secondaryLocations: string[];
  publishedAt: string;                       // ISO date
  isListed: boolean;
  isRemote: boolean | null;
  workplaceType: string | null;              // Remote | Hybrid | OnSite | AsynchronousRemote
  address: {
    postalAddress?: {
      addressRegion?: string;
      addressCountry?: string;
      addressLocality?: string;
    };
  } | null;
  jobUrl: string;
  applyUrl: string;
  descriptionHtml: string;
  descriptionPlain: string;
}

export interface AshbyBoardResponse {
  jobs: RawAshbyJob[];
}

// ─── Raw Workday job shape ─────────────────────────────────────────────────────
// Actual shape from Workday CXS API (confirmed against accenture.wd103)

export interface RawWorkdayJob {
  title: string;
  externalPath: string;         // e.g. '/job/Paris/Software-Engineer_R00123'
  postedOn: string | null;      // 'Posted Today', 'Posted 2 Days Ago', etc.
  bulletFields: string[];       // [requisitionId, location, ...]
}

export interface WorkdayResponse {
  total: number;
  jobPostings: RawWorkdayJob[];
}

// ─── Raw Meta job shape ───────────────────────────────────────────────────────

export interface RawMetaJob {
  id: string;
  title: string;
  sub_teams: string[];
  team_title: string | null;
  locations: string[];
  remote_type: string | null;
  type: string | null;          // 'Full-Time', 'Part-Time'
  post_date: string | null;     // 'YYYY-MM-DD'
  url: string;
}

// ─── Raw Google job shape ─────────────────────────────────────────────────────

export interface RawGoogleJob {
  name: string;                 // 'jobs/12345'
  title: string;
  locations: Array<{ display: string }>;
  applicationInfo: { uris: string[] };
  description: string | null;
  qualifications: string | null;
  responsibilities: string | null;
  publishTime: string | null;   // ISO datetime
  categories: string[];
}
