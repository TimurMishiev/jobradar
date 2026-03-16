export type AtsType = 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'meta' | 'google';

export interface CompanyConfig {
  name: string;       // display name stored in DB
  slug: string;       // short identifier used internally
  ats: AtsType;
  boardToken: string; // token used in the ATS API URL
  // Workday-specific: full subdomain host (e.g. 'accenture.wd103.myworkdayjobs.com')
  workdayHost?: string;
  // Workday-specific: job board path segment (e.g. 'Accenture_Careers')
  workdayBoard?: string;
}

// ─── Confirmed target companies ───────────────────────────────────────────────
// Tokens verified against live APIs on 2026-03-16.

export const TARGET_COMPANIES: CompanyConfig[] = [
  // Greenhouse
  {
    name: 'Anthropic',
    slug: 'anthropic',
    ats: 'greenhouse',
    boardToken: 'anthropic',
  },
  {
    name: 'Anduril',
    slug: 'anduril',
    ats: 'greenhouse',
    boardToken: 'andurilindustries',
  },

  // Ashby
  {
    name: 'OpenAI',
    slug: 'openai',
    ats: 'ashby',
    boardToken: 'openai',
  },
  {
    name: 'Perplexity',
    slug: 'perplexity',
    ats: 'ashby',
    boardToken: 'perplexity',
  },
  {
    name: 'Rune Technologies',
    slug: 'rune',
    ats: 'ashby',
    boardToken: 'runetech',
  },

  // Lever
  {
    name: 'Palantir',
    slug: 'palantir',
    ats: 'lever',
    boardToken: 'palantir',
  },
  {
    name: 'Shield AI',
    slug: 'shield-ai',
    ats: 'lever',
    boardToken: 'shieldai',
  },
  {
    name: 'Reveal Technology',
    slug: 'reveal',
    ats: 'lever',
    boardToken: 'revealtech',
  },

  // Workday (scrapers)
  {
    name: 'Accenture',
    slug: 'accenture',
    ats: 'workday',
    boardToken: 'accenture',
    workdayHost: 'accenture.wd103.myworkdayjobs.com',
    workdayBoard: 'AccentureCareers',
  },

  // Custom scrapers
  {
    name: 'Meta',
    slug: 'meta',
    ats: 'meta',
    boardToken: 'meta',
  },
  {
    name: 'Google',
    slug: 'google',
    ats: 'google',
    boardToken: 'google',
  },
];
