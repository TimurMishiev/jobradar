# ─── Stage 1: Install all workspace dependencies ─────────────────────────────
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy manifests first — changes to source won't bust this cache layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/api/package.json   packages/api/
COPY packages/web/package.json   packages/web/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build API and web ───────────────────────────────────────────────
FROM deps AS builder

COPY . .

# Generate Prisma client (must run before tsc so generated types are available)
RUN pnpm --filter @jobradar/api exec prisma generate

# Compile API TypeScript → dist/
RUN pnpm --filter @jobradar/api exec tsc

# Build web (Vite → packages/web/dist/)
RUN pnpm --filter @jobradar/web exec vite build

# ─── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/api/package.json   packages/api/
COPY packages/shared/package.json packages/shared/

# Copy Prisma schema BEFORE install so @prisma/client postinstall can generate
COPY packages/api/prisma packages/api/prisma

# Install production dependencies only (prisma CLI + @prisma/client included)
RUN pnpm install --frozen-lockfile --prod

# Copy compiled API
COPY --from=builder /app/packages/api/dist packages/api/dist

# Copy built web static assets (served by Fastify in production)
COPY --from=builder /app/packages/web/dist packages/web/dist

# Resume upload directory — local filesystem fallback (swap for S3 in v1.8)
RUN mkdir -p packages/api/uploads/resumes

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", \
  "node_modules/.bin/prisma migrate deploy --schema packages/api/prisma/schema.prisma && \
   node packages/api/dist/index.js"]
