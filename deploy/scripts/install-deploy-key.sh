#!/usr/bin/env bash
# Instala la clave pública de deploy en authorized_keys del servidor.
set -euo pipefail

REMOTE="${1:-softone@192.168.1.2}"
KEY_FILE="$(cd "$(dirname "$0")/.." && pwd)/keys/softone_deploy.pub"

if [[ ! -f "$KEY_FILE" ]]; then
    echo "ERROR: falta $KEY_FILE — ejecuta ssh-keygen en deploy/keys/ primero." >&2
    exit 1
fi

PUBKEY="$(cat "$KEY_FILE")"
MARKER="github-deploy-softone"

ssh "$REMOTE" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && \
  if grep -qF '$MARKER' ~/.ssh/authorized_keys 2>/dev/null; then \
    echo 'Clave de deploy ya instalada.'; \
  else \
    echo '$PUBKEY' >> ~/.ssh/authorized_keys && \
    chmod 600 ~/.ssh/authorized_keys && \
    echo 'Clave de deploy instalada.'; \
  fi"

echo "OK. Verifica: ssh $REMOTE 'grep github-deploy ~/.ssh/authorized_keys'"
