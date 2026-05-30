# Claves SSH de despliegue (GitHub Actions)

La **clave privada** (`softone_deploy`) está en este directorio y está en `.gitignore`. **No la subas al repositorio.**

## Clave pública (instalar en el servidor)

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP3Ex1SJ3BE3ec54dE/d7tBHzKpCEXV98GbQBbPUTDGE github-deploy-softone
```

## Instalar en el servidor (desde LAN)

```bash
# Opción A: script automático
deploy/scripts/install-deploy-key.sh softone@192.168.1.2

# Opción B: manual en el servidor
ssh softone@192.168.1.2
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP3Ex1SJ3BE3ec54dE/d7tBHzKpCEXV98GbQBbPUTDGE github-deploy-softone" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Secret `SSH_PRIVATE_KEY` en GitHub

Copiar el contenido completo de `deploy/keys/softone_deploy` (incluyendo las líneas `BEGIN`/`END`) en:

**GitHub → largoMiguel/app-django → Settings → Secrets → Actions → SSH_PRIVATE_KEY**

Ver también [deploy/docs/cloudflare-access-setup.md](../docs/cloudflare-access-setup.md).
