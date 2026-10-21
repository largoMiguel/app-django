#!/usr/bin/env bash
# CNAME monitor.softone360.com → túnel Cloudflare existente (Beszel hub).
set -euo pipefail

ZONE_NAME="${CF_ZONE_NAME:-softone360.com}"
TUNNEL_ID="${CF_TUNNEL_ID:-1b010f95-dd5a-4236-bd6d-a71c6ef79d15}"
TUNNEL_CNAME="${TUNNEL_ID}.cfargotunnel.com"
RECORD_NAME="${CF_BESZEL_SUBDOMAIN:-monitor}"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]] && [[ -n "${1:-}" ]] && [[ -f "${1}" ]]; then
  CLOUDFLARE_API_TOKEN="$(grep '^CLOUDFLARE_API_TOKEN=' "$1" | cut -d= -f2- | tr -d '\r')"
fi
: "${CLOUDFLARE_API_TOKEN:?Export CLOUDFLARE_API_TOKEN o pasa ruta al .env como primer argumento}"

api() {
  curl -fsS -X "$1" "https://api.cloudflare.com/client/v4$2" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${@:3}"
}

echo "==> Resolviendo zone_id de ${ZONE_NAME}…"
ZONE_ID="$(api GET "/zones?name=${ZONE_NAME}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'])")"

echo "==> DNS CNAME ${RECORD_NAME} → ${TUNNEL_CNAME}…"
existing="$(api GET "/zones/${ZONE_ID}/dns_records?type=CNAME&name=${RECORD_NAME}.${ZONE_NAME}" | python3 -c "
import sys, json
r = json.load(sys.stdin)['result']
print(r[0]['id'] if r else '')
")"
payload="$(python3 - <<PY
import json
print(json.dumps({
  "type": "CNAME",
  "name": "${RECORD_NAME}",
  "content": "${TUNNEL_CNAME}",
  "proxied": True,
  "ttl": 1,
}))
PY
)"
if [[ -n "$existing" ]]; then
  api PUT "/zones/${ZONE_ID}/dns_records/${existing}" --data "$payload" >/dev/null
else
  api POST "/zones/${ZONE_ID}/dns_records" --data "$payload" >/dev/null
fi

echo "OK. https://${RECORD_NAME}.${ZONE_NAME} → túnel ${TUNNEL_ID}"
