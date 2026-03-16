# JobRadar

AI-assisted job intelligence platform. Aggregates job postings from multiple ATS providers, normalizes and deduplicates them, and surfaces a personalized feed with save/ignore/applied tracking.

## Features

- Pulls live job postings from Greenhouse, Lever, and Ashby
- Normalizes titles, remote type, seniority, and description across all sources
- Deduplicates on re-ingestion so the same job is never stored twice
- Paginated job feed with filters (company, remote type, seniority)
- Save, ignore, and applied workflow per job
- User profile with target titles, skills, preferred locations, and remote preference
- Resume upload and management (used for AI scoring in Phase 4)
- Dark UI built with React and Vite

## Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| API      | Fastify v5, TypeScript, Prisma v6       |
| Database | PostgreSQL 16                           |
| Web      | React 18, Vite 5, TanStack Query v5     |
| Monorepo | pnpm workspaces                         |

## Project Structure

```
packages/
  api/       Fastify backend, Prisma schema, connectors, ingestion service
  web/       React frontend, pages, components, hooks
  shared/    TypeScript types shared between api and web
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 running locally

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment files
cp .env.example .env
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env

# Edit packages/api/.env and set your DATABASE_URL
# Example: DATABASE_URL=postgresql://youruser@localhost:5432/signalhire

# Create the database (psql must be on your PATH)
createdb signalhire

# Run migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate
```

### Running locally

```bash
# Start both API and web dev servers
pnpm dev:api   # http://localhost:3000
pnpm dev:web   # http://localhost:5173
```

### Ingesting jobs

Trigger ingestion via the API:

```bash
# Ingest all companies
curl -X POST http://localhost:3000/api/ingest

# Ingest specific companies
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"companies": ["anthropic", "openai"]}'
```

Available company slugs: `anthropic`, `anduril`, `openai`, `palantir`, `shield-ai`

## API Routes

| Method | Path                    | Description                        |
| ------ | ----------------------- | ---------------------------------- |
| GET    | /health                 | Health check                       |
| GET    | /api/jobs               | Paginated job feed with filters    |
| GET    | /api/jobs/:id           | Job detail with full description   |
| POST   | /api/jobs/:id/action    | Set action (SAVED/IGNORED/APPLIED) |
| DELETE | /api/jobs/:id/action    | Remove action                      |
| GET    | /api/profile            | Get user profile                   |
| PUT    | /api/profile            | Update user profile                |
| GET    | /api/resumes            | List uploaded resumes              |
| DELETE | /api/resumes/:id        | Delete a resume                    |
| POST   | /api/ingest             | Trigger job ingestion              |
| GET    | /api/ingest/companies   | List configured companies          |

## Authentication

Optional. Set `API_KEY` in `packages/api/.env` to require an `X-API-Key` header on all requests. Leave it unset to run without auth (default for local development).

## Roadmap

- [x] Phase 1: Monorepo scaffold, database schema, base routes
- [x] Phase 2: Ingestion pipeline with Greenhouse, Lever, and Ashby connectors
- [x] Phase 3: React frontend with feed, filters, and job workflow
- [ ] Phase 4: AI scoring against user profile and resume using Claude
- [ ] Phase 5: Scheduled ingestion, email or push notifications
