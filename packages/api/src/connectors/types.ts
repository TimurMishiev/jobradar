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
