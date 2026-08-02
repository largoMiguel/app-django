#!/usr/bin/env bash
# Continúa migración DB tras fallo de permisos.
set -euo pipefail

PROD_VOL=$(docker volume inspect softone_db_data --format '{{ .Mountpoint }}')
DEMO_VOL=$(docker volume inspect softone-demo_db_data --format '{{ .Mountpoint }}')

echo "Prod vol: $PROD_VOL"
echo "Demo vol: $DEMO_VOL"

rm -rf /srv/postgres/prod/* /srv/postgres/demo/*
cp -a "$PROD_VOL"/. /srv/postgres/prod/
cp -a "$DEMO_VOL"/. /srv/postgres/demo/
chown -R 999:999 /srv/postgres/prod /srv/postgres/demo
chmod 700 /srv/postgres/prod /srv/postgres/demo

du -sh /srv/postgres/prod /srv/postgres/demo

echo "==> Levantar prod"
cd /opt/softone-app && deploy/scripts/deploy.sh

echo "==> Levantar demo"
cd /opt/softone-demo && deploy/scripts/deploy-demo.sh

echo "==> Verificar montajes"
docker inspect softone-db --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{ "\n" }}{{ end }}'
docker inspect softone-demo-db --format '{{ range .Mounts }}{{ .Source }} -> {{ .Destination }}{{ "\n" }}{{ end }}'

PROD_AFTER=$(docker exec softone-db psql -U softone -d softone -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
DEMO_AFTER=$(docker exec softone-demo-db psql -U softone_demo -d softone_demo -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
echo "prod tablas: $PROD_AFTER | demo tablas: $DEMO_AFTER"
echo "MIGRATION_DB_OK"
