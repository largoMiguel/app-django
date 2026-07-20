#!/usr/bin/env bash
# Despliega el stack en el servidor. Idempotente; sólo recrea servicios
# cuya imagen o configuración haya cambiado.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: falta .env en $ROOT_DIR" >&2
    exit 1
fi
chmod 600 "$ENV_FILE"

cd "$DEPLOY_DIR"

echo "==> Construyendo imágenes…"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build --pull

echo "==> Levantando servicios…"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --remove-orphans

echo "==> Recargando nginx (conf montada por volumen)…"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T nginx nginx -s reload

echo "==> Estado:"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" ps

echo "==> Esperando salud de servicios…"
healthy=0
for _ in $(seq 1 24); do
  if docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T backend \
      curl -fsS http://localhost:8000/api/health >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 5
done
if [[ "$healthy" -ne 1 ]]; then
  echo "ERROR: backend no respondió healthy tras 120s" >&2
  exit 1
fi

echo "==> Smoke test interno…"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T nginx wget -qO- http://127.0.0.1/healthz | grep -q ok
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" exec -T backend curl -fsS http://localhost:8000/api/health | grep -q ok

echo "==> Cron de backups y mantenimiento…"
bash "$DEPLOY_DIR/scripts/setup-maintenance-cron.sh"

echo
echo "OK. App pública: https://app.softone360.com"
