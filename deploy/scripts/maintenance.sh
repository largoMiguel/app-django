#!/usr/bin/env bash
# Tareas de mantenimiento periódico (tokens JWT, logs Docker).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
cd "$DEPLOY_DIR"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

echo "==> $(date -Is) Limpieza tokens JWT expirados"
$COMPOSE exec -T backend python manage.py flushexpiredtokens

echo "==> $(date -Is) Prune imágenes Docker huérfanas (>7 días)"
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true

echo "OK maintenance $(date -Is)"
