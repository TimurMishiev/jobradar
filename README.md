# JobRadar

AI-assisted personal job intelligence platform. Aggregates job postings from 19 companies across multiple ATS providers, scores each job against your resume and profile using GPT-4o-mini, and surfaces a personalized feed with save/apply/ignore tracking.

## Features

- **Multi-source ingestion** — Greenhouse, Lever, Ashby, and Workday connectors; auto-deduplicates on every run
- **Scheduled ingestion** — runs every 4 hours automatically via node-cron
- **AI job scoring** — GPT-4o-mini scores each job 0–100 against your profile and resume, with match reasons and missing signals
- **Resume-aware scoring** — upload a PDF resume; extracted text is included in every scoring prompt
- **Preferred company boost** — jobs from your watchlist companies get a +5 score boost
- **Smart re-scoring** — profile or resume changes automatically trigger background rescoring
- **Natural language search** — type "senior ML engineer remote" and filters auto-populate via GPT
- **Structured filters** — company, seniority, remote type, location, role/title, posted within
- **Daily digest** — Strong Matches (score ≥ 70), New Today, and Watchlist sections
- **Job workflow** — Save, Apply, and Ignore per job with optional notes
- **Tracker page** — tabbed Saved / Applied view with timestamps and inline notes
- **Workday enrichment** — descriptions fetched lazily on first open and bulk-enriched in background after every ingestion
- **Score freshness** — shows "Scored X ago" on each job detail
- **User profile** — target titles, skills, preferred companies, locations, remote preference, seniority levels
- **Dark/light theme** — persisted to localStorage
- **Single-user, local-first** — no auth required, runs entirely on your machine

## Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| API      | Fastify v5, TypeScript, Prisma v6       |
| Database | PostgreSQL 16                           |
| Web      | React 18, Vite 5, TanStack Query v5     |
| AI       | OpenAI gpt-4o-mini                      |
| Monorepo | pnpm workspaces                         |

## Supported Companies (19)

| Company               | ATS        |
| --------------------- | ---------- |
| Anthropic             | Greenhouse |
| Anduril               | Greenhouse |
| Applied Intuition     | Greenhouse |
| Epirus                | Greenhouse |
| Rebellion Defense     | Greenhouse |
| Saildrone             | Greenhouse |
| Vannevar Labs         | Greenhouse |
| OpenAI                | Ashby      |
| Perplexity            | Ashby      |
| Rune Technologies     | Ashby      |
| Skydio                | Ashby      |
| Palantir              | Lever      |
| Shield AI             | Lever      |
| Reveal Technology     | Lever      |
| Accenture             | Workday    |
| Booz Allen Hamilton   | Workday    |
| Leidos                | Workday    |
| Meta                  | Custom (stub — needs Playwright) |
| Google                | Custom (stub — needs Playwright) |

## Project Structure

```
packages/
  api/       Fastify backend, Prisma schema, connectors, ingestion, scoring
  web/       React frontend, pages, components, hooks
  shared/    TypeScript types shared between api and web
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 running locally
- OpenAI API key (optional — app runs without it, scoring and NL search are disabled)

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

Ingestion also runs automatically every 4 hours. After each run, Workday job descriptions are bulk-enriched in the background (100 most recent first), then scored.

### AI Scoring

Add `OPENAI_API_KEY` to `packages/api/.env`, then:

- **Save your profile** — triggers background scoring for all unscored jobs
- **Upload a resume** — text is extracted and included in every scoring prompt
- **Set a default resume** — triggers a full rescore pass with the new resume
- **Open any job** — auto-scores on first view if no score exists yet
- **Score manually** — `POST /api/jobs/:id/score`

Scores are 0–100 with match reasons, missing signals, and a plain-English summary. Jobs from preferred companies receive a +5 boost.

## API Routes

| Method | Path                        | Description                                                     |
| ------ | --------------------------- | --------------------------------------------------------------- |
| GET    | /api/jobs                   | Paginated feed (filters: company, seniority, remoteType, location, title, postedWithin) |
| GET    | /api/jobs/:id               | Job detail with scores and user actions                         |
| POST   | /api/jobs/:id/action        | Set action: SAVED / APPLIED / IGNORED                          |
| DELETE | /api/jobs/:id/action        | Remove action                                                   |
| POST   | /api/jobs/:id/score         | Score a job against profile + default resume                    |
| GET    | /api/digest                 | Daily digest: top scored, new today, watchlist                  |
| GET    | /api/profile                | Get user profile                                                |
| PUT    | /api/profile                | Update profile (triggers background scoring)                    |
| GET    | /api/resumes                | List uploaded resumes                                           |
| POST   | /api/resumes                | Upload a PDF resume (multipart/form-data)                       |
| PATCH  | /api/resumes/:id/default    | Set default resume (triggers full rescore)                      |
| DELETE | /api/resumes/:id            | Delete a resume                                                 |
| POST   | /api/ingest                 | Trigger ingestion (all companies or filtered by slug)           |
| GET    | /api/ingest/companies       | List all configured companies                                   |
| POST   | /api/search/parse           | Parse a natural language query into structured filters          |

## Roadmap

- [x] Phase 1: Monorepo scaffold, database schema, base routes
- [x] Phase 2: Ingestion pipeline — Greenhouse, Lever, Ashby, Workday connectors
- [x] Phase 3: React frontend — feed, filters, job workflow, dark/light theme
- [x] Phase 4: AI scoring with GPT-4o-mini, resume upload, profile preferences
- [x] Phase 5: Scheduled ingestion (node-cron, every 4h)
- [x] Phase 6: 17 companies across 4 ATS providers, Workday description enrichment
- [x] v1.1: Resume-aware scoring, structured match explanations, digest page, score triggers
- [x] v1.3: Smart re-scoring, score freshness, bulk Workday enrichment
- [ ] Playwright connectors for Meta and Google
- [ ] Deployment (Railway / Render)
