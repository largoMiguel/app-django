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

# Celery worker/beat: no migrar ni collectstatic (evita carreras entre contenedores).
case "${1:-}" in
  celery)
    echo ">> Celery — omitiendo migraciones"
    exec gosu appuser "$@"
    ;;
esac

# Volúmenes Docker (static/media) se crean como root; appuser debe poder escribir.
mkdir -p /app/staticfiles /app/media
chown -R appuser:appuser /app/staticfiles /app/media

echo ">> Migraciones"
gosu appuser python manage.py migrate --noinput

echo ">> Bootstrap (roles + admin inicial)"
gosu appuser python manage.py bootstrap_app

echo ">> Collectstatic"
gosu appuser python manage.py collectstatic --noinput --clear

echo ">> Arrancando aplicación"
exec gosu appuser "$@"
