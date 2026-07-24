#!/usr/bin/env bash
# Crea registros DNS demo + files-demo apuntando al túnel Cloudflare existente.
set -euo pipefail

ZONE_NAME="${CF_ZONE_NAME:-softone360.com}"
TUNNEL_ID="${CF_TUNNEL_ID:-1b010f95-dd5a-4236-bd6d-a71c6ef79d15}"
TUNNEL_CNAME="${TUNNEL_ID}.cfargotunnel.com"

: "${CLOUDFLARE_API_TOKEN:?Export CLOUDFLARE_API_TOKEN}"

# Evitar source del .env completo (valores con +/= rompen bash)
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]] && [[ -n "${1:-}" ]] && [[ -f "${1}" ]]; then
  CLOUDFLARE_API_TOKEN="$(grep '^CLOUDFLARE_API_TOKEN=' "$1" | cut -d= -f2- | tr -d '\r')"
fi
: "${CLOUDFLARE_API_TOKEN:?Export CLOUDFLARE_API_TOKEN}"

api() {
  curl -fsS -X "$1" "https://api.cloudflare.com/client/v4$2" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${@:3}"
}

echo "==> Resolviendo zone_id de ${ZONE_NAME}…"
ZONE_ID="$(api GET "/zones?name=${ZONE_NAME}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'])")"

upsert_cname() {
  local name="$1"
  echo "==> DNS CNAME ${name} → ${TUNNEL_CNAME}…"
  existing="$(api GET "/zones/${ZONE_ID}/dns_records?type=CNAME&name=${name}.${ZONE_NAME}" | python3 -c "
import sys, json
r = json.load(sys.stdin)['result']
print(r[0]['id'] if r else '')
")"
  payload="$(python3 - <<PY
import json
print(json.dumps({
  "type": "CNAME",
  "name": "${name}",
  "content": "${TUNNEL_CNAME}",
  "proxied": True,
  "ttl": 1,
}))
PY
)"
  if [[ -n "$existing" ]]; then
    api PUT "/zones/${ZONE_ID}/dns_records/${existing}" -d "$payload" >/dev/null
    echo "    actualizado"
  else
    api POST "/zones/${ZONE_ID}/dns_records" -d "$payload" >/dev/null
    echo "    creado"
  fi
}

upsert_cname demo
upsert_cname files-demo

echo
echo "OK. DNS listo. Asegúrate de tener ingress en deploy/cloudflared/config.yml:"
echo "  demo.softone360.com → http://softone-demo-nginx:80"
echo "  files-demo.softone360.com → http://softone-demo-nginx:80"
echo
echo "Reinicia cloudflared en prod tras desplegar config:"
echo "  cd /opt/softone-app/deploy && docker compose -f docker-compose.prod.yml --env-file ../.env restart cloudflared"
