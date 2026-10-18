#!/usr/bin/env bash
# Ajustes de host para servidor SoftOne (NVMe + 16 GB RAM, Ryzen 8c/16t). Idempotente.
set -euo pipefail

echo "==> Ampliar LVM raíz al espacio libre del VG"
if sudo vgs ubuntu-vg >/dev/null 2>&1; then
  sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv 2>/dev/null || true
  sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv 2>/dev/null || true
fi

echo "==> fstab: noatime en / y /srv/postgres (si aplica)"
ROOT_DEV=$(findmnt -no SOURCE /)
PG_DEV=$(findmnt -no SOURCE /srv/postgres 2>/dev/null || true)
for dev in "$ROOT_DEV" "$PG_DEV"; do
  [[ -z "$dev" ]] && continue
  UUID=$(blkid -s UUID -o value "$dev" 2>/dev/null || true)
  [[ -z "$UUID" ]] && continue
  if grep -q "UUID=$UUID" /etc/fstab && ! grep -q "UUID=$UUID.*noatime" /etc/fstab; then
    sudo sed -i "s|UUID=$UUID \\([^ ]*\\) \\([^ ]*\\) defaults\\(.*\\)|UUID=$UUID \\1 \\2 defaults,noatime\\3|" /etc/fstab
  fi
done
sudo mount -o remount,noatime / 2>/dev/null || true
[[ -n "$PG_DEV" ]] && sudo mount -o remount,noatime /srv/postgres 2>/dev/null || true

echo "==> CPU EPP performance (systemd)"
sudo tee /etc/systemd/system/softone-cpu-perf.service >/dev/null <<'UNIT'
[Unit]
Description=SoftOne CPU energy performance preference
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'for f in /sys/devices/system/cpu/cpu*/cpufreq/energy_performance_preference; do echo performance > "$f" 2>/dev/null || true; done'

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now softone-cpu-perf.service

echo "==> BBR + buffers de red"
echo tcp_bbr | sudo tee /etc/modules-load.d/bbr.conf >/dev/null
sudo modprobe tcp_bbr 2>/dev/null || true
sudo tee /etc/sysctl.d/99-softone.conf >/dev/null <<'SYSCTL'
vm.swappiness=10
vm.dirty_ratio=15
vm.dirty_background_ratio=5
vm.max_map_count=262144
net.core.somaxconn=4096
net.core.netdev_max_backlog=16384
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
net.ipv4.tcp_fastopen=3
net.ipv4.tcp_slow_start_after_idle=0
net.ipv4.ip_local_port_range=1024 65535
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
SYSCTL
sudo sysctl --system >/dev/null

echo "==> NIC: desactivar EEE (enp5s0)"
sudo tee /etc/systemd/system/softone-nic-eee-off.service >/dev/null <<'UNIT'
[Unit]
Description=Disable Ethernet EEE on enp5s0
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/ethtool --set-eee enp5s0 eee off

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now softone-nic-eee-off.service 2>/dev/null || true

echo "==> Disco SATA DB: read_ahead"
sudo tee /etc/udev/rules.d/60-softone-sata-db.rules >/dev/null <<'UDEV'
ACTION=="add|change", KERNEL=="sda", ATTR{queue/read_ahead_kb}="256"
UDEV
echo 256 | sudo tee /sys/block/sda/queue/read_ahead_kb >/dev/null 2>&1 || true

echo "==> Servicios innecesarios en servidor headless"
for svc in ModemManager wpa_supplicant multipathd bolt upower udisks2; do
  sudo systemctl disable --now "$svc" 2>/dev/null || true
done

echo "==> TRIM periódico (NVMe / SSD)"
sudo systemctl enable fstrim.timer
sudo systemctl start fstrim.timer 2>/dev/null || true

echo "==> Docker: log rotation"
sudo mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
  echo '{}' | sudo tee /etc/docker/daemon.json >/dev/null
fi
sudo python3 - <<'PY'
import json
from pathlib import Path
p = Path("/etc/docker/daemon.json")
data = json.loads(p.read_text() or "{}")
data.setdefault("log-driver", "json-file")
data.setdefault("log-opts", {})
data["log-opts"].setdefault("max-size", "50m")
data["log-opts"].setdefault("max-file", "3")
p.write_text(json.dumps(data, indent=2) + "\n")
PY
sudo systemctl restart docker

echo "==> Resumen"
cat /sys/devices/system/cpu/cpu0/cpufreq/energy_performance_preference 2>/dev/null || true
sysctl net.ipv4.tcp_congestion_control net.core.default_qdisc vm.swappiness
df -h / /srv/postgres 2>/dev/null || df -h /
echo "OK host tune"
