#!/usr/bin/env bash
# Fase D: mover datos PostgreSQL a /srv/postgres (disco 1TB).
set -euo pipefail

BACKUP_DIR="/var/backups/softone/migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "==> Dump de seguridad prod"
docker exec softone-db pg_dump -U softone -d softone -F c > "$BACKUP_DIR/softone_prod.dump"

echo "==> Dump de seguridad demo"
docker exec softone-demo-db pg_dump -U softone_demo -d softone_demo -F c > "$BACKUP_DIR/softone_demo.dump"

echo "==> Conteos antes"
PROD_BEFORE=$(docker exec softone-db psql -U softone -d softone -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
DEMO_BEFORE=$(docker exec softone-demo-db psql -U softone_demo -d softone_demo -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
echo "prod tablas: $PROD_BEFORE | demo tablas: $DEMO_BEFORE"

echo "==> Bajar stacks"
cd /opt/softone-app/deploy
docker compose -f docker-compose.prod.yml --env-file ../.env down
cd /opt/softone-demo/deploy
docker compose -f docker-compose.demo.yml --env-file ../.env down

echo "==> Copiar datos de volúmenes a disco 1TB"
PROD_VOL=$(docker volume inspect softone_db_data --format '{{ .Mountpoint }}')
DEMO_VOL=$(docker volume inspect softone-demo_db_data --format '{{ .Mountpoint }}')

rm -rf /srv/postgres/prod/* /srv/postgres/demo/* 2>/dev/null || true
cp -a "$PROD_VOL"/. /srv/postgres/prod/
cp -a "$DEMO_VOL"/. /srv/postgres/demo/
chown -R 999:999 /srv/postgres/prod /srv/postgres/demo
chmod 700 /srv/postgres/prod /srv/postgres/demo

echo "==> Sincronizar compose actualizado"
# El script asume que sync.sh ya corrió o los archivos están en /opt

echo "==> Levantar stacks"
cd /opt/softone-app && deploy/scripts/deploy.sh
cd /opt/softone-demo && deploy/scripts/deploy-demo.sh

echo "==> Conteos después"
sleep 10
PROD_AFTER=$(docker exec softone-db psql -U softone -d softone -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
DEMO_AFTER=$(docker exec softone-demo-db psql -U softone_demo -d softone_demo -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
echo "prod tablas: $PROD_AFTER | demo tablas: $DEMO_AFTER"

echo "==> Verificar montaje DB"
docker inspect softone-db --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{ "\n" }}{{ end }}'
docker inspect softone-demo-db --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{ "\n" }}{{ end }}'

echo "MIGRATION_DB_OK backups en $BACKUP_DIR"
