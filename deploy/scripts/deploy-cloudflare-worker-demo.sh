#!/usr/bin/env bash
# Despliega el Worker de entrega demo (files-demo.softone360.com → storage-demo).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER_DIR="$ROOT_DIR/deploy/cloudflare-worker"
ENV_FILE="${1:-$ROOT_DIR/.env}"

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

npx wrangler deploy --config wrangler.demo.toml

printf '%s' "$B2_KEY_ID" | npx wrangler secret put B2_KEY_ID --config wrangler.demo.toml
printf '%s' "$B2_APP_KEY" | npx wrangler secret put B2_APP_KEY --config wrangler.demo.toml
printf '%s' "$FILE_DELIVERY_SIGNING_KEY" | npx wrangler secret put FILE_DELIVERY_SIGNING_KEY --config wrangler.demo.toml

echo "OK: Worker demo desplegado en https://files-demo.softone360.com"
