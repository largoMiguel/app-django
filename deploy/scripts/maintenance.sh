#!/usr/bin/env bash
# Tareas de mantenimiento periódico (logs Docker, imágenes huérfanas).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
cd "$DEPLOY_DIR"

echo "==> $(date -Is) Prune imágenes Docker huérfanas (>7 días)"
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true

echo "OK maintenance $(date -Is)"
