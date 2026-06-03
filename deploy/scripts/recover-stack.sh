#!/usr/bin/env bash
# Recupera el stack sin bajar el túnel Cloudflare (no usar docker compose down).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: falta .env en $ROOT_DIR" >&2
    exit 1
fi

cd "$ROOT_DIR"
export COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env"

echo "==> Eliminando contenedores huérfanos de softone (sin down)…"
for name in softone-frontend softone-backend softone-nginx softone-db softone-cloudflared; do
  docker rm -f "$name" 2>/dev/null || true
done

echo "==> Deploy…"
deploy/scripts/deploy.sh
