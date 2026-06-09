#!/usr/bin/env bash
# Lee el buzón PQRS vía IMAP y crea radicados (con flock para evitar solapes).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
LOCK_FILE="/tmp/softone-pqrs-inbox.lock"
cd "$DEPLOY_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Otro proceso de ingesta PQRS está en curso; omitiendo."
  exit 0
fi

docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T backend \
  python manage.py ingest_pqrs_inbox
