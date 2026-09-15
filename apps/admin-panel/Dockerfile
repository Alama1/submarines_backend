ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

ARG PNPM_VERSION=11.24.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-workspace.yaml tsconfig.base.json* ./
COPY pnpm-lock.yaml* ./

COPY packages/ ./packages/
COPY apps/admin-panel/ ./apps/admin-panel/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ff14/types build
RUN pnpm --filter @ff14/admin-panel build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runner

ENV API_GATEWAY_HOST=api-gateway \
    API_GATEWAY_PORT=3000 \
    FIREBASE_API_KEY="" \
    FIREBASE_AUTH_DOMAIN="" \
    FIREBASE_PROJECT_ID="" \
    FIREBASE_STORAGE_BUCKET="" \
    FIREBASE_MESSAGING_SENDER_ID="" \
    FIREBASE_APP_ID=""

COPY --from=builder --chown=101:101 /app/apps/admin-panel/dist /usr/share/nginx/html
COPY apps/admin-panel/nginx.conf /etc/nginx/templates/default.conf.template
COPY apps/admin-panel/config.js.template /etc/nginx/admin-config.js.template
COPY --chown=101:101 apps/admin-panel/docker/40-admin-config.sh /docker-entrypoint.d/40-admin-config.sh
RUN chmod +x /docker-entrypoint.d/40-admin-config.sh

USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
