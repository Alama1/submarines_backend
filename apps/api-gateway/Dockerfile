FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# Workspace manifests & base tsconfig
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml* ./

# Copy shared packages and this service
COPY packages/ ./packages/
COPY apps/api-gateway/ ./apps/api-gateway/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ff14/types build
RUN pnpm --filter @ff14/entities build
RUN pnpm --filter @ff14/internal-auth build
RUN pnpm --filter @ff14/api-gateway build

# ── Production image ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY --from=builder /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules

WORKDIR /app/apps/api-gateway
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -q --spider "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
CMD ["node", "dist/main.js"]
