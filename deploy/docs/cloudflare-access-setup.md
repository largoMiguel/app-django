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

## Cloudflare Access (opcional, recomendado)

Con el túnel SSH actual, GitHub Actions y el acceso manual funcionan usando `cloudflared access ssh` + clave ed25519, **sin** Service Token.

Para añadir una capa extra (login email OTP + Service Token para CI), configura en **Zero Trust → Access → Applications**:

1. Tipo: **Self-hosted**
2. Application name: `SoftOne SSH`
3. Subdomain: `ssh`, Domain: `softone360.com`
4. Política **Allow** para `contactenos@softone360.com` (o tu email Cloudflare)
5. (Opcional) Service Token `github-actions-deploy` + política **Service Auth**

Si creas Service Token, añade los secrets `CF_ACCESS_CLIENT_ID` y `CF_ACCESS_CLIENT_SECRET` en GitHub.

Automatización vía API (requiere `CF_API_TOKEN` con permisos Zero Trust):

```bash
export CF_API_TOKEN=...
deploy/scripts/setup-cloudflare-access.sh
```

## Secrets en GitHub

| Secret | Valor |
|--------|-------|
| `SSH_PRIVATE_KEY` | contenido de `deploy/keys/softone_deploy` |
| `DEPLOY_HOST` | `ssh.softone360.com` |
| `DEPLOY_USER` | `softone` |
| `CF_ACCESS_CLIENT_ID` | (opcional) Client ID del Service Token |
| `CF_ACCESS_CLIENT_SECRET` | (opcional) Client Secret del Service Token |

Configuración automática (requiere PAT con permiso `repo` + secrets):

```bash
export GITHUB_TOKEN=ghp_...
python3 deploy/scripts/setup-github-secrets-api.py
```

O con `gh` CLI:

```bash
deploy/scripts/setup-github-secrets.sh
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
  ProxyCommand cloudflared access ssh --hostname %h
```

## Reiniciar túnel tras cambios de config

```bash
cd /opt/softone-app
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d cloudflared
docker compose -f deploy/docker-compose.prod.yml --env-file .env logs --tail=30 cloudflared
```
