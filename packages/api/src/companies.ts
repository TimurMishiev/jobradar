export type AtsType = 'greenhouse' | 'lever' | 'ashby';

export interface CompanyConfig {
  name: string;       // display name stored in DB
  slug: string;       // short identifier used internally
  ats: AtsType;
  boardToken: string; // token used in the ATS API URL
}

// ─── Confirmed target companies ───────────────────────────────────────────────
// Tokens verified against live APIs on 2026-03-16.
//
// Not yet resolved (no ATS token found):
//   - Reveal Technology
//   - Rune Technologies
// Add them here once their ATS/board token is identified.

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
];
