# Configuración Cloudflare Access para SSH remoto

Repositorio: `git@github.com:largoMiguel/app-django.git`

## Estado configurado en el servidor

| Paso | Estado |
|------|--------|
| DNS CNAME `ssh.softone360.com` → túnel | Hecho (`cloudflared tunnel route dns`) |
| Ingress SSH en `deploy/cloudflared/config.yml` | Hecho |
| `extra_hosts: host.docker.internal` en Docker | Hecho |
| Clave deploy en `authorized_keys` | Hecho |
| SSH remoto vía `cloudflared access ssh` | Verificado |

Comando usado para DNS:

```bash
cloudflared tunnel route dns 1b010f95-dd5a-4236-bd6d-a71c6ef79d15 ssh.softone360.com
```

## Cloudflare Access (opcional)

El acceso manual y el despliegue desde tu Mac usan `cloudflared access ssh` + clave ed25519 (`deploy/keys/softone_deploy`), **sin** Service Token.

Para añadir login email OTP en Zero Trust → Access → Applications:

1. Tipo: **Self-hosted**
2. Application name: `SoftOne SSH`
3. Subdomain: `ssh`, Domain: `softone360.com`
4. Política **Allow** para el correo autorizado (ej. `contactenos@softone360.com`)

Automatización vía API (requiere `CF_API_TOKEN` con permisos Zero Trust):

```bash
export CF_API_TOKEN=...
deploy/scripts/setup-cloudflare-access.sh
```

## Verificar SSH remoto

```bash
ssh -o ProxyCommand="cloudflared access ssh --hostname %h" softone@ssh.softone360.com
```

O con alias en `~/.ssh/config`:

```
Host softone-prod
  HostName ssh.softone360.com
  User softone
  IdentityFile /ruta/a/app_django/deploy/keys/softone_deploy
  ProxyCommand cloudflared access ssh --hostname %h
```

LAN (MikroTik, misma red):

```
Host softone-lan
  HostName 192.168.88.2
  User softone
  IdentityFile /ruta/a/app_django/deploy/keys/softone_deploy
```

## Desplegar desde tu máquina

```bash
# Demo (rama development)
deploy/scripts/sync-demo.sh softone-prod
ssh softone-prod 'cd /opt/softone-demo && deploy/scripts/deploy-demo.sh'

# Producción (rama main)
deploy/scripts/sync.sh softone-prod
ssh softone-prod 'cd /opt/softone-app && deploy/scripts/deploy.sh'
```

En LAN puedes usar `softone-lan` en lugar de `softone-prod`.

## Reiniciar túnel tras cambios de config

```bash
cd /opt/softone-app
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d cloudflared
docker compose -f deploy/docker-compose.prod.yml --env-file .env logs --tail=30 cloudflared
```
