# Claves SSH de despliegue

La **clave privada** (`softone_deploy`) va en este directorio y está en `.gitignore`. **No la subas al repositorio.**

El despliegue es **manual por SSH** (`deploy/scripts/sync.sh` + `deploy.sh` en el servidor). GitHub solo guarda el código; no hay GitHub Actions.

## Clave pública (instalar en el servidor)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP3Ex1SJ3BE3ec54dE/d7tBHzKpCEXV98GbQBbPUTDGE github-deploy-softone
```

## Instalar en el servidor (desde LAN)

```bash
# Opción A: script automático (alias SSH softone-lan → 192.168.88.2)
deploy/scripts/install-deploy-key.sh softone-lan

# Opción B: manual en el servidor
ssh softone-lan
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP3Ex1SJ3BE3ec54dE/d7tBHzKpCEXV98GbQBbPUTDGE github-deploy-softone" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Ver también [deploy/docs/cloudflare-access-setup.md](../docs/cloudflare-access-setup.md).
