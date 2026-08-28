# Build context: monorepo root
# Usage: docker build -f apps/inventory-worker/Dockerfile .
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace manifests & base tsconfig
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml* ./

# Copy shared packages and this service
COPY packages/ ./packages/
COPY apps/inventory-worker/ ./apps/inventory-worker/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ff14/types build
RUN pnpm --filter @ff14/entities build
RUN pnpm --filter @ff14/inventory-worker build

# ── Production image ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/inventory-worker/package.json ./apps/inventory-worker/package.json
COPY --from=builder /app/apps/inventory-worker/dist ./apps/inventory-worker/dist
COPY --from=builder /app/apps/inventory-worker/node_modules ./apps/inventory-worker/node_modules

WORKDIR /app/apps/inventory-worker
CMD ["node", "dist/main.js"]
