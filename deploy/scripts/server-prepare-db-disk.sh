#!/usr/bin/env bash
# Fase C: preparar SSD 1TB para PostgreSQL en /srv/postgres.
set -euo pipefail

DISK=/dev/sdb
MOUNT=/srv/postgres

apt-get install -y parted dosfstools gdisk >/dev/null 2>&1 || true

echo "==> Borrando particiones previas en $DISK"
wipefs -a "$DISK"
sgdisk --zap-all "$DISK"

echo "==> Creando GPT con una partición ext4"
parted -s "$DISK" mklabel gpt
parted -s "$DISK" mkpart primary ext4 1MiB 100%
partprobe "$DISK"
sleep 2

PART="${DISK}1"
mkfs.ext4 -F -L postgres_data "$PART"

UUID=$(blkid -s UUID -o value "$PART")
mkdir -p "$MOUNT"

if grep -q "$MOUNT" /etc/fstab; then
  sed -i "\|$MOUNT|d" /etc/fstab
fi
echo "UUID=$UUID $MOUNT ext4 defaults,noatime 0 2" >> /etc/fstab

mount "$PART" "$MOUNT"

mkdir -p "$MOUNT/prod" "$MOUNT/demo"
chown -R 999:999 "$MOUNT/prod" "$MOUNT/demo"
chmod 700 "$MOUNT/prod" "$MOUNT/demo"

echo "==> RESULTADO"
lsblk -o NAME,SIZE,FSTYPE,LABEL,UUID,MOUNTPOINT "$DISK"
findmnt "$MOUNT"
ls -la "$MOUNT"
