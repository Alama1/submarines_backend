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

2. Migrate the postgres data volume — **this is the only state that matters.**

   On the VPS the live stack (`submarines_backend`) stores the database in
   volume `submarines_backend_postgres_data` (~64 MB, actively used). The new
   postgres stack uses `submarines_postgres_data`, which already exists on the
   VPS but is an **empty leftover from 2025-08-13** — deploying the new stack
   without copying data first means the DB comes up empty.

   Do the copy with the old postgres **stopped** (avoids WAL/cache races):

   ```bash
   # stop just postgres (or the whole old stack via Portainer)
   docker stop submarines_backend-postgres-1

   docker run --rm \
     -v submarines_backend_postgres_data:/from:ro \
     -v submarines_postgres_data:/to \
     alpine sh -c "cp -a /from/. /to"

   # proceed to deploy the new stacks, remove the old stack when verified
   ```

   RabbitMQ needs no migration: its volume is anonymous and every service
   re-declares its queues on startup — you only get a few seconds of queue
   downtime during the switch.

3. VPS-specific env values to replicate in the new Portainer stacks:

   | Variable | Value on VPS | Stacks |
   |---|---|---|
   | `API_GATEWAY_PORT` | `3005` (not the 3000 default) | api-gateway, admin-panel |
   | `API_GATEWAY_HOST` | `api-gateway` | admin-panel |
   | `NODE_ENV` | baked into images already | — |

   Copy the remaining values (passwords, tokens, Firebase keys, CORS) from the
   old stack's environment screen in Portainer before taking it down.

4. Orphan containers: `submarines_backend-redis-1` and
   `submarines_backend-order-worker-1` are leftovers from an old stack revision
   (not in the current compose, not referenced by any running service). After
   the new stacks are verified healthy, remove them:

   ```bash
   docker rm -f submarines_backend-redis-1 submarines_backend-order-worker-1
   ```

5. In Portainer: **Stacks → Add stack → Repository**, set the compose path from
   the table above, paste the env vars from the matching `.env.example`, and
   deploy. Deploy `postgres` and `rabbitmq` first, then everything else.
   Cross-stack `depends_on` is not possible, but healthchecks + restart
   policies cover startup ordering.

## Watchtower

The VPS watchtower already runs with `WATCHTOWER_LABEL_ENABLE=true`,
`WATCHTOWER_CLEANUP=true`, 60s poll — exactly what the labels expect, so
**no new watchtower stack is needed**; it will pull new `latest` images and
recreate only the labeled containers within a minute of CI publishing.

- If you'd rather update postgres/rabbitmq manually, just delete the
  `labels:` block from their compose files.
- If you ever set up watchtower elsewhere, deploy
  `deploy/watchtower/docker-compose.yml` (configured for label mode).
- Private `ghcr.io` images require registry credentials — either `docker login
  ghcr.io` on the host (watchtower reuses the host's config) or pass registry
  env vars to watchtower.

## Teardown of the old stack

After all new stacks are running and healthy, remove the old single stack in
Portainer. Keep `docker-compose.yml` (dev, builds locally) and
`docker-compose.infra.yml` (local infra) — they still work for local
development and are unaffected.
