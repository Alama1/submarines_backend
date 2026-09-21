# Per-Service Portainer Stacks

Each service now lives in its own Portainer stack instead of one big stack.
All stacks share one external Docker network (`submarines`) so they can reach
each other by container name, and every app container carries the watchtower
opt-in label so your existing watchtower (label-enable mode) picks up new
`latest` images automatically.

## Layout

| Stack | Compose path | Notes |
|---|---|---|
| postgres | `deploy/postgres/docker-compose.yml` | `container_name: postgres`, volume `submarines_postgres_data` |
| rabbitmq | `deploy/rabbitmq/docker-compose.yml` | `container_name: rabbitmq`, volume `submarines_rabbitmq_data` |
| api-gateway | `deploy/api-gateway/docker-compose.yml` | port 3000 |
| admin-panel | `deploy/admin-panel/docker-compose.yml` | port 8080 |
| prices-service | `deploy/prices-service/docker-compose.yml` | |
| inventory-service | `deploy/inventory-service/docker-compose.yml` | |
| orders-service | `deploy/orders-service/docker-compose.yml` | |
| recipes-service | `deploy/recipes-service/docker-compose.yml` | |
| price-worker | `deploy/price-worker/docker-compose.yml` | |
| inventory-worker | `deploy/inventory-worker/docker-compose.yml` | |
| watchtower | `deploy/watchtower/docker-compose.yml` | optional, only if not already running one |

Each folder also has a `.env.example` listing the variables to paste into the
Portainer stack's "Environment variables" section.

## One-time setup

1. Create the shared network (once, on the host):

   ```bash
   docker network create submarines
   ```

2. Migrate existing data volumes. The old single stack stored data in
   `<old-stack-name>_postgres_data` / `<old-stack-name>_rabbitmq_data`.
   The new stacks use fixed names `submarines_postgres_data` /
   `submarines_rabbitmq_data`. Either copy the data:

   ```bash
   docker run --rm -v <old-stack>_postgres_data:/from -v submarines_postgres_data:/to alpine sh -c "cp -a /from/. /to"
   docker run --rm -v <old-stack>_rabbitmq_data:/from -v submarines_rabbitmq_data:/to alpine sh -c "cp -a /from/. /to"
   ```

   ...or, to keep using the old volumes directly, replace the `volumes:` block
   in the postgres/rabbitmq composes with:

   ```yaml
   volumes:
     postgres_data:
       external: true
       name: <old-stack>_postgres_data
   ```

3. In Portainer: **Stacks → Add stack → Repository**, set the compose path from
   the table above, paste the env vars from the matching `.env.example`, and
   deploy. Deploy `postgres` and `rabbitmq` first, then everything else.
   Cross-stack `depends_on` is not possible, but healthchecks + restart
   policies cover startup ordering.

## Watchtower

All app services carry `com.centurylinkfoundation.watchtower.enable=true`.
If your watchtower runs with `WATCHTOWER_LABEL_ENABLE=true` it will
automatically pull new `latest` images and recreate only these containers.

- If you'd rather update postgres/rabbitmq manually, just delete the
  `labels:` block from their compose files.
- If your existing watchtower is *not* label-enabled, deploy the included
  `deploy/watchtower/docker-compose.yml` (it is configured for label mode and
  cleans up stale images).
- Private `ghcr.io` images require registry credentials — either `docker login
  ghcr.io` on the host (watchtower reuses the host's config) or pass registry
  env vars to watchtower.

## Teardown of the old stack

After all new stacks are running and healthy, remove the old single stack in
Portainer. Keep `docker-compose.yml` (dev, builds locally) and
`docker-compose.infra.yml` (local infra) — they still work for local
development and are unaffected.
