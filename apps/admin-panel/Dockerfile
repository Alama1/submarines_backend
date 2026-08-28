# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Workspace manifests & root configs
COPY package.json pnpm-workspace.yaml tsconfig.base.json* ./
COPY pnpm-lock.yaml* ./

# Copy shared packages and admin-panel
COPY packages/ ./packages/
COPY apps/admin-panel/ ./apps/admin-panel/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ff14/types build
RUN pnpm --filter @ff14/admin-panel build

# ── Stage 2: Nginx Static & Proxy Server ──────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/admin-panel/dist /usr/share/nginx/html
COPY apps/admin-panel/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]