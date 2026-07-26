# CinoVid AI Studio — Railway Production Dockerfile

# ═══════════════════════════════════════════
# STAGE 1: Build
# ═══════════════════════════════════════════
FROM node:20-slim AS builder

# Native addon build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace metadata (Docker layer cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/shared/package.json ./packages/shared/
COPY packages/video-template/package.json ./packages/video-template/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter web build

# ═══════════════════════════════════════════
# STAGE 2: Lean Production Runner
# ═══════════════════════════════════════════
FROM node:20-slim AS runner

# Minimal runtime deps only (no audio/chromium)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Native better-sqlite3 (compiled for linux in builder)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Persistent data dir
RUN mkdir -p /app/data /app/data/uploads

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
