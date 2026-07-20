#!/usr/bin/env bash
# Deploy softone-files worker from laptop using secrets on softone-prod.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKER_DIR="$ROOT/deploy/cloudflare-worker"

# Fetch secrets without printing values
eval "$(ssh softone-prod 'python3 - <<'"'"'PY'"'"'
from pathlib import Path
import shlex
env = {}
for line in Path("/opt/softone-app/.env").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    v = v.strip().strip("\"'\''")
    if k in {"CLOUDFLARE_API_TOKEN", "B2_KEY_ID", "B2_APP_KEY", "FILE_DELIVERY_SIGNING_KEY"}:
        print(f"export {k}={shlex.quote(v)}")
PY')"

: "${CLOUDFLARE_API_TOKEN:?}"
: "${B2_KEY_ID:?}"
: "${B2_APP_KEY:?}"
: "${FILE_DELIVERY_SIGNING_KEY:?}"

cd "$WORKER_DIR"
npm install --silent
npx wrangler deploy
printf '%s' "$B2_KEY_ID" | npx wrangler secret put B2_KEY_ID
printf '%s' "$B2_APP_KEY" | npx wrangler secret put B2_APP_KEY
printf '%s' "$FILE_DELIVERY_SIGNING_KEY" | npx wrangler secret put FILE_DELIVERY_SIGNING_KEY
echo "OK: Worker desplegado con softone-correspondence en ALLOWED_BUCKETS"
