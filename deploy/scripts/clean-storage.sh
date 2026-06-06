#!/usr/bin/env bash
# Limpia almacenamiento local y cubos B2 (reinicio desde cero).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
cd "$DEPLOY_DIR"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

echo "==> Vaciando cubos B2…"
$COMPOSE exec -T backend python manage.py purge_b2_buckets

echo "==> Limpiando media local (volumen Docker)…"
$COMPOSE exec -T backend sh -c 'find /app/media -mindepth 1 -delete 2>/dev/null || true'

echo "==> Limpiando backups locales…"
BACKUP_DIR=/var/backups/softone
if [[ -d "$BACKUP_DIR" ]]; then
  find "$BACKUP_DIR" -type f -name 'softone_*.dump' -delete 2>/dev/null || true
fi

echo "==> Prune imágenes Docker huérfanas (>7 días)…"
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true

echo "OK: almacenamiento limpio $(date -Is)"
