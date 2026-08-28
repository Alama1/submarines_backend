# Build context: monorepo root
# Usage: docker build -f apps/order-worker/Dockerfile .
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace manifests & base tsconfig
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml* ./

# Copy shared packages and this service
COPY packages/ ./packages/
COPY apps/order-worker/ ./apps/order-worker/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ff14/types build
RUN pnpm --filter @ff14/entities build
RUN pnpm --filter @ff14/order-worker build

# ── Production image ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/order-worker/package.json ./apps/order-worker/package.json
COPY --from=builder /app/apps/order-worker/dist ./apps/order-worker/dist
COPY --from=builder /app/apps/order-worker/node_modules ./apps/order-worker/node_modules

WORKDIR /app/apps/order-worker
CMD ["node", "dist/main.js"]
