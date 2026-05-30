#!/usr/bin/env bash
# Crea app Access SSH + service token vía Cloudflare API (requiere CF_API_TOKEN).
set -euo pipefail

ACCOUNT_ID="${CF_ACCOUNT_ID:-6031fdec2d3f25ad748f6c5519281536}"
HOSTNAME="${CF_SSH_HOSTNAME:-ssh.softone360.com}"
ADMIN_EMAIL="${CF_ADMIN_EMAIL:-contactenos@softone360.com}"
APP_NAME="${CF_ACCESS_APP_NAME:-SoftOne SSH}"
TOKEN_NAME="${CF_SERVICE_TOKEN_NAME:-github-actions-deploy}"

if [[ -z "${CF_API_TOKEN:-}" ]]; then
    echo "ERROR: export CF_API_TOKEN con permisos Zero Trust Access (Apps + Service Tokens Write)" >&2
    exit 1
fi

api() {
    local method="$1" path="$2" data="${3:-}"
    if [[ -n "$data" ]]; then
        curl -fsS -X "$method" "https://api.cloudflare.com/client/v4${path}" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "$data"
    else
        curl -fsS -X "$method" "https://api.cloudflare.com/client/v4${path}" \
            -H "Authorization: Bearer $CF_API_TOKEN" \
            -H "Content-Type: application/json"
    fi
}

echo "==> Creando service token…"
ST_RESP="$(api POST "/accounts/${ACCOUNT_ID}/access/service_tokens" \
    "{\"name\":\"${TOKEN_NAME}\",\"duration\":\"8760h\"}")"
TOKEN_ID="$(echo "$ST_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r['id'])")"
CLIENT_ID="$(echo "$ST_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r['client_id'])")"
CLIENT_SECRET="$(echo "$ST_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r['client_secret'])")"

echo "==> Creando aplicación Access…"
APP_RESP="$(api POST "/accounts/${ACCOUNT_ID}/access/apps" "$(cat <<JSON
{
  "name": "${APP_NAME}",
  "domain": "${HOSTNAME}",
  "type": "self_hosted",
  "session_duration": "24h",
  "allowed_idps": [],
  "auto_redirect_to_identity": false
}
JSON
)")"
APP_ID="$(echo "$APP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['id'])")"

echo "==> Política Allow (${ADMIN_EMAIL})…"
api POST "/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" "$(cat <<JSON
{
  "name": "Allow admin email",
  "decision": "allow",
  "include": [{"email": {"email": "${ADMIN_EMAIL}"}}],
  "precedence": 1
}
JSON
)" >/dev/null

echo "==> Política Service Auth (GitHub Actions)…"
api POST "/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" "$(cat <<JSON
{
  "name": "GitHub Actions service token",
  "decision": "non_identity",
  "include": [{"service_token": {"token_id": "${TOKEN_ID}"}}],
  "precedence": 2
}
JSON
)" >/dev/null

echo
echo "OK. Cloudflare Access configurado para ${HOSTNAME}"
echo
echo "Añade en GitHub Secrets:"
echo "  CF_ACCESS_CLIENT_ID=${CLIENT_ID}"
echo "  CF_ACCESS_CLIENT_SECRET=${CLIENT_SECRET}"
echo
echo "(El client secret solo se muestra una vez; guárdalo ahora.)"
