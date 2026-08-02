#!/usr/bin/env bash
# Fase A: limpieza del servidor sin cortar servicio.
set -euo pipefail

echo "==> Builder prune (cache no usada >24h)"
docker builder prune -f --filter until=24h

echo "==> Volúmenes huérfanos"
docker volume ls -qf dangling=true | xargs -r docker volume rm

echo "==> Journal vacuum + límite 200M"
journalctl --vacuum-size=200M
if grep -q '^SystemMaxUse=' /etc/systemd/journald.conf; then
  sed -i 's/^SystemMaxUse=.*/SystemMaxUse=200M/' /etc/systemd/journald.conf
else
  echo 'SystemMaxUse=200M' >> /etc/systemd/journald.conf
fi
systemctl restart systemd-journald

echo "==> APT clean + autoremove"
export DEBIAN_FRONTEND=noninteractive
apt-get clean
apt-get autoremove --purge -y

echo "==> DESPUÉS"
df -h / | tail -1
docker system df 2>/dev/null | head -5
journalctl --disk-usage
