#!/usr/bin/env bash
# Sincroniza el repo hacia /opt/softone-demo (preserva .env).
set -euo pipefail

REMOTE="${1:-softone@192.168.1.2}"
REMOTE_PATH="/opt/softone-demo"
DEPLOY_KEY="$(cd "$(dirname "$0")/.." && pwd)/keys/softone_deploy"
RSYNC_SSH="ssh -o StrictHostKeyChecking=accept-new"
if [[ -f "$DEPLOY_KEY" ]]; then
    RSYNC_SSH="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new"
fi

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
    --exclude 'logs' \
    --exclude 'venv' \
    --exclude 'deploy/cloudflared/*.json' \
    --exclude 'deploy/sites/lavonia/www' \
    -e "$RSYNC_SSH" \
    ./ "$REMOTE:$REMOTE_PATH/"

echo "OK. Sincronizado a $REMOTE:$REMOTE_PATH"
echo "Ahora: ssh softone-lan 'cd $REMOTE_PATH && deploy/scripts/deploy-demo.sh'"
echo "Keys IA prod→demo: ssh softone-lan 'bash $REMOTE_PATH/deploy/scripts/sync-demo-ai-from-prod.sh'"
