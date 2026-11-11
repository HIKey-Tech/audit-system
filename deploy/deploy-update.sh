#!/usr/bin/env bash
# Idempotent production update script for the GBB IAMS VPS (/opt/iams/app).
# Follows docs/VPS_DEPLOYMENT_RUNBOOK.md §10 ("Deploy an update").
#
# Run AFTER pulling code on the VPS:
#   cd /opt/iams/app
#   git pull origin dev
#   bash deploy/deploy-update.sh
#
# Options:
#   --sync-permissions   Re-apply canonical role permissions from prisma/seed.ts
#                        via scripts/seed-role-permissions.ts (NEVER runs db-seed;
#                        touches no user passwords/2FA, though custom UI edits on
#                        standard built-in role names are reset to defaults).
#   --skip-backup        Skip /opt/iams/backup.sh (only if you just ran a backup).
#   --help               Show usage.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"
SYNC_PERMISSIONS=false
SKIP_BACKUP=false

for arg in "$@"; do
  case "$arg" in
    --sync-permissions) SYNC_PERMISSIONS=true ;;
    --skip-backup)      SKIP_BACKUP=true ;;
    --help|-h)
      sed -n '2,17p' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: $APP_DIR/.env not found. Aborting." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: $APP_DIR/$COMPOSE_FILE not found. Aborting." >&2
  exit 1
fi

echo "==> [1/6] Checking commit & pre-deploy backup"
echo "Current HEAD: $(git log --oneline -1 2>/dev/null || echo 'unknown')"

if [[ "$SKIP_BACKUP" == "false" ]]; then
  if [[ -x /opt/iams/backup.sh ]]; then
    /opt/iams/backup.sh
    STAMP="$(date +%F)"
    if [[ ! -s "/opt/iams/backups/iams-${STAMP}.bak" || ! -s "/opt/iams/backups/uploads-${STAMP}.tgz" ]]; then
      echo "ERROR: Expected today's backups in /opt/iams/backups/iams-${STAMP}.bak and uploads-${STAMP}.tgz" >&2
      exit 1
    fi
    ls -lh "/opt/iams/backups/iams-${STAMP}.bak" "/opt/iams/backups/uploads-${STAMP}.tgz"
  else
    echo "ERROR: /opt/iams/backup.sh not found or not executable. Take a manual backup first or pass --skip-backup." >&2
    exit 1
  fi
else
  echo "Skipping backup (--skip-backup supplied)."
fi

echo "==> [2/6] Loading .env and building Docker images (with --profile ops)"
set -a
# shellcheck disable=SC1091
source .env
set +a

docker compose -f "$COMPOSE_FILE" --profile ops build

echo "==> [3/6] Applying Prisma database migrations"
docker compose -f "$COMPOSE_FILE" --profile ops run --rm db-migrate

if [[ "$SYNC_PERMISSIONS" == "true" ]]; then
  echo "==> [4/6] Syncing canonical role permissions (safe — no users touched)"
  docker compose -f "$COMPOSE_FILE" --profile ops run --rm \
    -v "$PWD/scripts:/app/scripts:ro" \
    db-migrate npx ts-node scripts/seed-role-permissions.ts
else
  echo "==> [4/6] Skipping role permission sync (pass --sync-permissions if this release changed role grants)"
fi

echo "==> [5/6] Restarting production containers"
docker compose -f "$COMPOSE_FILE" up -d
docker compose -f "$COMPOSE_FILE" ps

echo "==> [6/6] Waiting for iams-api health check"
HEALTH_OK=false
for attempt in $(seq 1 20); do
  if HEALTH_OUT="$(docker compose -f "$COMPOSE_FILE" exec -T iams-api \
    node -e "fetch('http://localhost:3000/health').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)}).catch(()=>process.exit(1))" 2>/dev/null)"; then
    echo "Health check passed (attempt $attempt): $HEALTH_OUT"
    HEALTH_OK=true
    break
  fi
  sleep 2
done

if [[ "$HEALTH_OK" != "true" ]]; then
  echo "ERROR: iams-api did not pass /health check in time. Recent logs:" >&2
  docker compose -f "$COMPOSE_FILE" logs --tail=150 iams-api >&2
  exit 1
fi

echo "==> Recent iams-api logs"
docker compose -f "$COMPOSE_FILE" logs --tail=40 iams-api
echo "Deployment complete."
