#!/bin/sh
set -e

echo ">> Esperando a Postgres en ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}…"
python - <<'PY'
import os, socket, time
host = os.getenv("POSTGRES_HOST", "db")
port = int(os.getenv("POSTGRES_PORT", "5432"))
for i in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            print("   db up")
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("DB no respondió tras 60s")
PY

echo ">> Migraciones"
python manage.py migrate --noinput

echo ">> Bootstrap (roles + admin inicial)"
python manage.py bootstrap_app

echo ">> Collectstatic"
python manage.py collectstatic --noinput --clear

exec "$@"
