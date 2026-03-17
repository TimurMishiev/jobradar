# JobRadar

AI-assisted personal job intelligence platform. Aggregates job postings from 19 companies across multiple ATS providers, scores each job against your resume and profile using GPT-4o-mini, and surfaces a personalized daily feed with contextual signals, AI briefings, and gap analysis.

## Features

### Ingestion & Scoring
- **Multi-source ingestion** — Greenhouse, Lever, Ashby, and Workday connectors; auto-deduplicates on every run
- **Scheduled ingestion** — runs every 4 hours automatically via node-cron
- **AI job scoring** — GPT-4o-mini scores each job 0–100 against your profile and resume, with match reasons and missing signals
- **Resume-aware scoring** — upload a PDF resume; text is extracted and included in every scoring prompt
- **Resume skill extraction** — GPT auto-detects up to 40 technical skills from your resume; used separately from your manually-specified target skills
- **Preferred company boost** — jobs from your watchlist get a +5 score boost
- **Smart re-scoring** — profile or resume changes automatically trigger background rescoring
- **Workday enrichment** — descriptions fetched lazily on first open and bulk-enriched in background after every ingestion

### Feed & Discovery
- **Priority badges** — HIGH (≥85) and MED (≥70) badges on job cards
- **Match signals on cards** — up to 2 ✓ match reasons and 1 ⚠ gap shown inline
- **Opportunity signals** — contextual timing signals computed per job:
  - ★ Watchlist — company is on your preferred list
  - ↑ Score improved — score went up after a rescore (e.g. "Score ↑ 72→81")
  - ↩ Prior interaction — you saved or applied to another role at this company
  - ⏱ Open Xd — role has been posted ≥14 days
- **Natural language search** — type "senior ML engineer remote" and filters auto-populate via GPT
- **Structured filters** — company, seniority, remote type, location, role/title, posted within

### AI Agents
- **Daily Briefing** — AI-generated headline, top picks with reasons, applied nudge, and watchlist highlights; auto-runs at 7am via cron; cooldown: 5 min between manual refreshes
- **Resume Gap Analysis** — detects recurring missing skills across your top-matched jobs; deterministic signal counting + GPT synthesis; cooldown: 15 min between refreshes
- Both agents persist results to the database; results are shown on the Digest page

### Job Tracking
- **Daily digest** — Strong Matches (≥70), New Today, and Watchlist sections
- **Job workflow** — Save, Apply, and Ignore per job with optional notes
- **Tracker page** — tabbed Saved / Applied view with timestamps and inline notes
- **Score freshness** — "Scored X ago" shown on each job detail

### Profile & Settings
- **User profile** — target titles, skills, preferred companies, locations, remote preference, seniority levels
- **Dark/light theme** — persisted to localStorage
- **Single-user, local-first** — no auth required, runs entirely on your machine

---

## Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| API      | Fastify v5, TypeScript, Prisma v6   |
| Database | PostgreSQL 16                       |
| Web      | React 18, Vite 5, TanStack Query v5 |
| AI       | OpenAI gpt-4o-mini                  |
| Monorepo | pnpm workspaces                     |

---

## Supported Companies (19)

| Company             | ATS                              |
| ------------------- | -------------------------------- |
| Anthropic           | Greenhouse                       |
| Anduril             | Greenhouse                       |
| Applied Intuition   | Greenhouse                       |
| Epirus              | Greenhouse                       |
| Rebellion Defense   | Greenhouse                       |
| Saildrone           | Greenhouse                       |
| Vannevar Labs       | Greenhouse                       |
| OpenAI              | Ashby                            |
| Perplexity          | Ashby                            |
| Rune Technologies   | Ashby                            |
| Skydio              | Ashby                            |
| Palantir            | Lever                            |
| Shield AI           | Lever                            |
| Reveal Technology   | Lever                            |
| Accenture           | Workday                          |
| Booz Allen Hamilton | Workday                          |
| Leidos              | Workday                          |
| Meta                | Custom (stub — needs Playwright) |
| Google              | Custom (stub — needs Playwright) |

---

## Project Structure

```
packages/
  api/       Fastify backend, Prisma schema, connectors, ingestion, scoring, agents
  web/       React frontend, pages, components, hooks
  shared/    TypeScript types shared between api and web
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 running locally
- OpenAI API key (optional — app runs without it, scoring/NL search/agents are disabled)

### Setup

```bash
# Install dependencies
pnpm install

# Edit packages/api/.env — set DATABASE_URL and optionally OPENAI_API_KEY
# Example:
#   DATABASE_URL=postgresql://youruser@localhost:5432/jobradar
#   OPENAI_API_KEY=sk-...
#   WEB_URL=http://localhost:5175

# Create the database
createdb jobradar

# Run migrations
cd packages/api && npx prisma migrate dev
```

### Running locally

```bash
pnpm --filter api dev    # API at http://localhost:3000
pnpm --filter web dev    # Web at http://localhost:5175
```

### Ingest jobs

```bash
# Ingest all companies
curl -X POST http://localhost:3000/api/ingest

# Ingest specific companies by slug
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"companies": ["anthropic", "openai", "leidos"]}'
```

Ingestion also runs automatically every 4 hours. After each run, Workday descriptions are bulk-enriched in the background, then unscored jobs are scored.

### AI Scoring

Add `OPENAI_API_KEY` to `packages/api/.env`, then:

- **Save your profile** — triggers background scoring for all unscored jobs
- **Upload a resume** — text is extracted; skills are auto-detected; both are included in every scoring prompt
- **Set a default resume** — triggers a full rescore pass
- **Open any job** — auto-scores on first view if no score exists yet
- **Score manually** — `POST /api/jobs/:id/score`

Scores are 0–100 with match reasons, missing signals, and a plain-English summary.

---

## API Reference

| Method | Path                              | Description                                                            |
| ------ | --------------------------------- | ---------------------------------------------------------------------- |
| GET    | /api/jobs                         | Paginated feed (filters: company, seniority, remoteType, location, title, postedWithin) |
| GET    | /api/jobs/:id                     | Job detail with scores, actions, and opportunity signals               |
| POST   | /api/jobs/:id/action              | Set action: SAVED / APPLIED / IGNORED                                  |
| DELETE | /api/jobs/:id/action              | Remove action                                                          |
| POST   | /api/jobs/:id/score               | Score a job against profile + default resume                           |
| GET    | /api/digest                       | Daily digest: top scored, new today, watchlist (with opportunity signals) |
| GET    | /api/insights/daily-briefing      | Latest AI daily briefing                                               |
| POST   | /api/insights/daily-briefing      | Generate a new briefing (429 if within 5-min cooldown)                 |
| GET    | /api/insights/gap-analysis        | Latest resume gap analysis                                             |
| POST   | /api/insights/gap-analysis        | Run a new gap analysis (429 if within 15-min cooldown)                 |
| GET    | /api/profile                      | Get user profile                                                       |
| PUT    | /api/profile                      | Update profile (triggers background scoring)                           |
| GET    | /api/resumes                      | List uploaded resumes                                                  |
| POST   | /api/resumes                      | Upload a PDF resume (multipart/form-data)                              |
| PATCH  | /api/resumes/:id/default          | Set default resume (triggers full rescore)                             |
| POST   | /api/resumes/:id/extract-skills   | Re-extract skills from a resume via GPT                                |
| DELETE | /api/resumes/:id                  | Delete a resume                                                        |
| POST   | /api/ingest                       | Trigger ingestion (all companies or filtered by slug)                  |
| GET    | /api/ingest/companies             | List all configured companies                                          |
| POST   | /api/search/parse                 | Parse a natural language query into structured filters                 |

---

## Roadmap

- [x] Foundation: monorepo scaffold, database schema, ingestion pipeline, React feed
- [x] AI scoring with GPT-4o-mini, resume upload, profile preferences
- [x] Greenhouse, Lever, Ashby, Workday connectors (17 companies)
- [x] Workday description enrichment (lazy + bulk background)
- [x] v1.1: Structured scoring (match reasons, missing signals, summary), digest page
- [x] v1.3: Smart re-scoring, score freshness, NL search, tracker page
- [x] v1.4: Agent layer — Daily Briefing, Gap Analysis, resume skill extraction, priority badges, match signals on cards
- [x] v1.5: Opportunity signals — watchlist, score improved, prior interaction, role open age
- [ ] v1.6: Application tracking improvements (kanban board, stage notes, stale nudge, CSV export)
- [ ] v1.7: Deployment prep (S3/R2 resume storage, Playwright for Meta/Google, Railway/Render config)
- [ ] v1.8: Onboarding flow, setup guide, rate limiting, profile export/import
