# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js (output: 'standalone') app (bun toolchain).
# Replaces the railpack build (~1.67 GB) with a slim runtime that ships only the
# standalone server + static assets. Build runs on bun; the standalone output is
# plain Node, so the runner is a minimal node image.
#
# NEXT_PUBLIC_* vars are inlined at build time and must be supplied as build args
# via the application's `buildArgs` field (Dokploy does not pass service env as
# --build-arg). REDIS_URL etc. are runtime-only and come from service env.

FROM oven/bun:1.3.4-slim AS base
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- build ----
FROM base AS build
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- runner ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --create-home nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
