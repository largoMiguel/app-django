#!/usr/bin/env bash
# Despliega el stack demo en el servidor (/opt/softone-demo).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="docker-compose.demo.yml"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: falta .env en $ROOT_DIR" >&2
    echo "Copia .env.demo.example → .env y completa los secretos." >&2
    exit 1
fi
chmod 600 "$ENV_FILE"

cd "$DEPLOY_DIR"

# Red edge compartida con prod (cloudflared en softone-app)
if ! docker network inspect softone_edge >/dev/null 2>&1; then
    echo "ERROR: falta la red softone_edge (levanta primero el stack prod)." >&2
    exit 1
fi

echo "==> Construyendo imágenes demo…"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --pull

echo "==> Levantando servicios demo…"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

echo "==> Recargando nginx demo…"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nginx nginx -s reload

echo "==> Estado:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo "==> Esperando salud del backend demo…"
healthy=0
for _ in $(seq 1 24); do
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend \
      curl -fsS http://localhost:8000/api/health >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 5
done
if [[ "$healthy" -ne 1 ]]; then
  echo "ERROR: backend demo no respondió healthy tras 120s" >&2
  exit 1
fi

echo "==> Smoke test interno…"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nginx wget -qO- http://127.0.0.1/healthz | grep -q ok
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend curl -fsS http://localhost:8000/api/health | grep -q ok

ensure_prod_tunnel_ingress() {
    local prod_app="/opt/softone-app"
    local prod_cfg="$prod_app/deploy/cloudflared/config.yml"
    local repo_cfg="$DEPLOY_DIR/cloudflared/config.yml"

    if [[ ! -d "$prod_app" ]] || [[ ! -f "$prod_cfg" ]] || [[ ! -f "$repo_cfg" ]]; then
        echo "==> Aviso: no se pudo verificar ingress del túnel prod (rutas ausentes)." >&2
        return 0
    fi

    if grep -q "demo.softone360.com" "$prod_cfg" \
        && grep -q "files-demo.softone360.com" "$prod_cfg"; then
        echo "==> Ingress demo ya presente en cloudflared prod; sin reinicio."
        return 0
    fi

    echo "==> Sincronizando ingress demo en cloudflared prod…"
    cp "$repo_cfg" "$prod_cfg"
    (
        cd "$prod_app/deploy"
        docker compose -f docker-compose.prod.yml --env-file ../.env restart cloudflared
    )
    echo "==> cloudflared prod reiniciado con ingress demo."
}

ensure_prod_tunnel_ingress

echo
echo "OK. Demo LAN: http://192.168.1.2:\${LAN_HTTP_PORT:-8081}"
echo "    Demo pública: https://demo.softone360.com"
