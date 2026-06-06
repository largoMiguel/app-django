#!/usr/bin/env bash
# Despliega el Worker de entrega de archivos (files.softone360.com).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER_DIR="$ROOT_DIR/deploy/cloudflare-worker"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: falta $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source <(grep -E '^(B2_KEY_ID|B2_APP_KEY|FILE_DELIVERY_SIGNING_KEY|CLOUDFLARE_API_TOKEN)=' "$ENV_FILE" | sed 's/^/export /')

: "${B2_KEY_ID:?Configure B2_KEY_ID en .env}"
: "${B2_APP_KEY:?Configure B2_APP_KEY en .env}"
: "${FILE_DELIVERY_SIGNING_KEY:?Configure FILE_DELIVERY_SIGNING_KEY en .env}"
: "${CLOUDFLARE_API_TOKEN:?Configure CLOUDFLARE_API_TOKEN en .env}"

export CLOUDFLARE_API_TOKEN

cd "$WORKER_DIR"
npm install --silent

npx wrangler deploy

printf '%s' "$B2_KEY_ID" | npx wrangler secret put B2_KEY_ID
printf '%s' "$B2_APP_KEY" | npx wrangler secret put B2_APP_KEY
printf '%s' "$FILE_DELIVERY_SIGNING_KEY" | npx wrangler secret put FILE_DELIVERY_SIGNING_KEY

echo "OK: Worker desplegado en https://files.softone360.com"
