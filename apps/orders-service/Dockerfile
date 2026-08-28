# Build context: monorepo root
# Usage: docker build -f apps/orders-service/Dockerfile .
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace manifests & base tsconfig
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml* ./

# Copy shared packages and this service
COPY packages/ ./packages/
COPY apps/orders-service/ ./apps/orders-service/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ff14/types build
RUN pnpm --filter @ff14/entities build
RUN pnpm --filter @ff14/orders-service build

# ── Production image ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/orders-service/package.json ./apps/orders-service/package.json
COPY --from=builder /app/apps/orders-service/dist ./apps/orders-service/dist
COPY --from=builder /app/apps/orders-service/node_modules ./apps/orders-service/node_modules

WORKDIR /app/apps/orders-service
EXPOSE 3003
CMD ["node", "dist/main.js"]
