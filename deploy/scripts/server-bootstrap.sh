#!/usr/bin/env bash
# Reinicia el servidor de cero para el nuevo stack Django + React.
#
# Acciones (DESTRUCTIVAS):
#   1. Elimina cualquier despliegue anterior en /opt/softone-app (Angular+FastAPI).
#   2. Para y borra todos los contenedores / imágenes / volúmenes Docker.
#   3. Elimina servicios systemd legacy (softone-*, fastapi, etc.).
#   4. Reinstala lo mínimo: docker, docker compose plugin, ufw, cloudflared.
#   5. Endurece sshd y ufw.
#
# Ejecutar como `softone@servidor` (con sudo NOPASSWD o se pedirá contraseña).
set -euo pipefail

echo "==> Bootstrap del servidor (Ubuntu Server)"
echo "    Hostname: $(hostname)"
echo "    Usuario:  $(whoami)"
echo

read -r -p "Esto BORRARÁ TODO el despliegue anterior. ¿Continuar? (escribe 'SI'): " CONFIRM
[[ "$CONFIRM" == "SI" ]] || { echo "Abortado."; exit 1; }

# --- 1) Apagar y borrar despliegues previos -----------------------------
echo "==> Apagando stacks Docker anteriores…"
if command -v docker >/dev/null 2>&1; then
    for compose_file in \
        /opt/softone-app/deploy/docker-compose.prod.yml \
        /opt/softone-app/docker-compose.prod.yml \
        /opt/softone-app/docker-compose.yml; do
        if [[ -f "$compose_file" ]]; then
            echo "    bajando $compose_file"
            sudo docker compose -f "$compose_file" down -v --remove-orphans || true
        fi
    done

    echo "==> Limpiando Docker (contenedores/imágenes/volúmenes/redes)…"
    sudo docker ps -aq | xargs -r sudo docker rm -f || true
    sudo docker volume ls -q | xargs -r sudo docker volume rm -f || true
    sudo docker network ls -q --filter type=custom | xargs -r sudo docker network rm || true
    sudo docker system prune -af --volumes || true
fi

# --- 2) Servicios systemd legacy (FastAPI/uvicorn/etc. en bare metal) ---
echo "==> Deshabilitando servicios legacy…"
for svc in softone-backend softone-frontend softone-api softone fastapi uvicorn gunicorn-softone; do
    sudo systemctl disable --now "$svc" 2>/dev/null || true
    sudo rm -f "/etc/systemd/system/${svc}.service"
done
sudo systemctl daemon-reload

# --- 3) Borrar código antiguo (preserva ~/.cloudflared) ------------------
echo "==> Borrando /opt/softone-app antiguo (preservando credenciales del túnel)…"
sudo rm -rf /opt/softone-app
echo "    ~/.cloudflared intacto:"
ls -la "$HOME/.cloudflared" || true

# --- 4) Paquetes base ---------------------------------------------------
echo "==> Actualizando paquetes…"
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg lsb-release ufw fail2ban rsync git unattended-upgrades

# Docker oficial (si no está)
if ! command -v docker >/dev/null 2>&1; then
    echo "==> Instalando Docker Engine…"
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
    sudo systemctl enable --now docker
fi

# cloudflared (para tareas administrativas; el túnel mismo corre en Docker)
if ! command -v cloudflared >/dev/null 2>&1; then
    echo "==> Instalando cloudflared CLI…"
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
        sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | \
        sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
    sudo apt-get update -y
    sudo apt-get install -y cloudflared
fi

# --- 5) Firewall --------------------------------------------------------
echo "==> Configurando UFW (sólo SSH entrante)…"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw --force enable
sudo ufw status verbose

# --- 6) Estructura destino ---------------------------------------------
echo "==> Preparando /opt/softone-app …"
sudo mkdir -p /opt/softone-app
sudo chown -R "$USER:$USER" /opt/softone-app

echo
echo "OK. Servidor listo para recibir el nuevo despliegue."
echo "Desde la máquina local:"
echo "    rsync -az ./ softone@<host>:/opt/softone-app/"
echo "    ssh softone@<host> 'cd /opt/softone-app && deploy/scripts/deploy.sh'"
