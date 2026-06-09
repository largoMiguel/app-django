#!/usr/bin/env bash
# Instala cron de backups diarios y mantenimiento Docker (prune imágenes).
set -euo pipefail

ROOT="/opt/softone-app"
MARKER="# softone-app maintenance"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

existing=$(crontab -l 2>/dev/null || true)
filtered=$(printf '%s\n' "$existing" | grep -Fv "$MARKER" | grep -Fv "deploy/scripts/backup-db.sh" | grep -Fv "deploy/scripts/maintenance.sh" | grep -Fv "deploy/scripts/ingest-pqrs-email.sh" || true)

{
  printf '%s\n' "$filtered" | sed '/^$/d'
  echo "0 3 * * * cd $ROOT && deploy/scripts/backup-db.sh >> $LOG_DIR/softone-backup.log 2>&1 $MARKER"
  echo "15 4 * * 0 cd $ROOT && deploy/scripts/maintenance.sh >> $LOG_DIR/softone-maintenance.log 2>&1 $MARKER"
  echo "*/3 * * * * cd $ROOT && deploy/scripts/ingest-pqrs-email.sh >> $LOG_DIR/softone-pqrs-inbox.log 2>&1 $MARKER"
} | crontab -

echo "OK. Cron instalado:"
crontab -l | grep "$MARKER"
