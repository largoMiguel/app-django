#!/usr/bin/env bash
# Hace un dump comprimido de Postgres a /var/backups/softone con retención 14 días.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
cd "$DEPLOY_DIR"

BACKUP_DIR=/var/backups/softone
if [[ ! -d "$BACKUP_DIR" ]]; then
  sudo mkdir -p "$BACKUP_DIR"
  sudo chown "$(id -u):$(id -g)" "$BACKUP_DIR"
fi

STAMP=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/softone_${STAMP}.dump"

POSTGRES_USER=$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
B2_BUCKET_DB=$(grep -E '^B2_BUCKET_DB=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
B2_BUCKET_DB=${B2_BUCKET_DB:-softone-db}

docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T db \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c > "$OUT"

# Subir a Backblaze B2 (softone-db) si B2 está configurado
if grep -qE '^B2_KEY_ID=.+' "$ENV_FILE" && grep -qE '^B2_APP_KEY=.+' "$ENV_FILE"; then
  docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T backend \
    python manage.py b2_upload \
      --bucket "$B2_BUCKET_DB" \
      --key "backups/softone_${STAMP}.dump" \
      --content-type "application/octet-stream" \
      --prune-days 30 \
      --prefix "backups/" < "$OUT"
fi

# Retención 14 días
find "$BACKUP_DIR" -name 'softone_*.dump' -mtime +14 -delete

echo "OK: $OUT ($(du -h "$OUT" | cut -f1))"
