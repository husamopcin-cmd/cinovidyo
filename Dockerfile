# CinoVid AI Studio — Railway Production Dockerfile
# Multi-stage: builder → lean runner

# ═══════════════════════════════════════════
# STAGE 1: Build
# ═══════════════════════════════════════════
FROM node:20-slim AS builder

# Build tools for native addons (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Activate pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config files first (enables Docker layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./

# Copy all package.json files to resolve workspace deps
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/shared/package.json ./packages/shared/
COPY packages/video-template/package.json ./packages/video-template/

# Install all dependencies (compiles better-sqlite3 here)
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Build only the web app (standalone output as configured in next.config.ts)
RUN pnpm --filter web build

# ═══════════════════════════════════════════
# STAGE 2: Lean Production Runner
# ═══════════════════════════════════════════
FROM node:20-slim AS runner

# Only runtime system deps (no build tools)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy the Next.js standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Copy public folder
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy the native better-sqlite3 addon (built for linux)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Persistent data directory (Railway disk mounts here, or falls back to this)
RUN mkdir -p /app/data /app/data/uploads

# Railway automatically injects PORT at runtime.
# Next.js standalone server.js reads process.env.PORT — no hardcoding needed.
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
