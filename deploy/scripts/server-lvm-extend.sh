#!/usr/bin/env bash
# Fase B: ampliar la raíz LVM al 100% del espacio libre.
set -euo pipefail

echo "==> ANTES"
df -h / | tail -1
vgs
lvs

lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv
resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv

echo "==> DESPUÉS"
df -h / | tail -1
vgs
lvs
