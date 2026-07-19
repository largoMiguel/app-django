#!/usr/bin/env bash
# Sincroniza el repositorio local hacia el servidor preservando .env y secretos.
set -euo pipefail

REMOTE="${1:-softone@192.168.1.2}"
REMOTE_PATH="/opt/softone-app"

cd "$(dirname "$0")/../.."

rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.venv' \
    --exclude 'staticfiles' \
    --exclude '.DS_Store' \
    --exclude '.env' \
    --exclude 'deploy/cloudflared/*.json' \
    --exclude 'deploy/sites/lavonia/www' \
    ./ "$REMOTE:$REMOTE_PATH/"

echo "OK. Sincronizado a $REMOTE:$REMOTE_PATH"
echo "Ahora: ssh $REMOTE 'cd $REMOTE_PATH && deploy/scripts/deploy.sh'"
