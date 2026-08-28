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

ENV API_GATEWAY_HOST=api-gateway \
    API_GATEWAY_PORT=3000 \
    FIREBASE_API_KEY="" \
    FIREBASE_AUTH_DOMAIN="" \
    FIREBASE_PROJECT_ID="" \
    FIREBASE_STORAGE_BUCKET="" \
    FIREBASE_MESSAGING_SENDER_ID="" \
    FIREBASE_APP_ID=""

COPY --from=builder /app/apps/admin-panel/dist /usr/share/nginx/html
COPY apps/admin-panel/nginx.conf /etc/nginx/templates/default.conf.template
COPY apps/admin-panel/config.js.template /etc/nginx/admin-config.js.template
COPY apps/admin-panel/docker/40-admin-config.sh /docker-entrypoint.d/40-admin-config.sh
RUN chmod +x /docker-entrypoint.d/40-admin-config.sh

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]