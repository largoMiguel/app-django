#!/usr/bin/env bash
# Configura secrets de GitHub Actions (requiere gh CLI autenticado).
set -euo pipefail

REPO="${1:-largoMiguel/app-django}"
KEY_FILE="$(cd "$(dirname "$0")/.." && pwd)/keys/softone_deploy"

if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: instala gh CLI (brew install gh) y ejecuta gh auth login" >&2
    exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
    echo "ERROR: falta $KEY_FILE" >&2
    exit 1
fi

gh secret set SSH_PRIVATE_KEY --repo "$REPO" < "$KEY_FILE"
gh secret set DEPLOY_HOST --repo "$REPO" --body "ssh.softone360.com"
gh secret set DEPLOY_USER --repo "$REPO" --body "softone"

echo "OK. Secrets SSH_PRIVATE_KEY, DEPLOY_HOST y DEPLOY_USER configurados."
echo "Faltan manualmente (desde Cloudflare Zero Trust):"
echo "  gh secret set CF_ACCESS_CLIENT_ID --repo $REPO"
echo "  gh secret set CF_ACCESS_CLIENT_SECRET --repo $REPO"
