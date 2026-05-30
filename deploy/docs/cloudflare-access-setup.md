# Configuración Cloudflare Access para SSH remoto

Pasos únicos en el dashboard de Cloudflare. Hacer **Access antes** de publicar el DNS `ssh`.

Repositorio: `git@github.com:largoMiguel/app-django.git`

## 1. DNS del túnel SSH

En **Cloudflare Dashboard → softone360.com → DNS → Records**:

| Campo | Valor |
|-------|-------|
| Type | CNAME |
| Name | `ssh` |
| Target | `1b010f95-dd5a-4236-bd6d-a71c6ef79d15.cfargotunnel.com` |
| Proxy | Proxied (nube naranja) |

## 2. Aplicación Access (SSH manual)

En **Zero Trust → Access → Applications → Add an application**:

1. Tipo: **Self-hosted**
2. Application name: `SoftOne SSH`
3. Session Duration: 24 hours (o lo que prefieras)
4. Subdomain: `ssh`, Domain: `softone360.com`
5. Identity providers: email OTP (o Google si lo usas)

**Policy 1 — acceso humano:**

- Action: Allow
- Include: tu email (`miguel@...` o el que uses en Cloudflare)

## 3. Service Token para GitHub Actions

En **Zero Trust → Access → Service Auth → Service Tokens → Create**:

1. Nombre: `github-actions-deploy`
2. Copiar **Client ID** y **Client Secret** (el secret solo se muestra una vez)

Volver a la aplicación `SoftOne SSH` y añadir:

**Policy 2 — CI/CD:**

- Action: Service Auth
- Include: el service token `github-actions-deploy`

## 4. Secrets en GitHub

En **github.com/largoMiguel/app-django → Settings → Secrets and variables → Actions**:

| Secret | Valor |
|--------|-------|
| `SSH_PRIVATE_KEY` | clave privada ed25519 de deploy (ver `deploy/keys/README.md`) |
| `CF_ACCESS_CLIENT_ID` | Client ID del service token |
| `CF_ACCESS_CLIENT_SECRET` | Client Secret del service token |
| `DEPLOY_HOST` | `ssh.softone360.com` |
| `DEPLOY_USER` | `softone` |

Opcional: crear **Environment** `production` en GitHub con los mismos secrets y protección de rama.

## 5. Reiniciar túnel en el servidor (primera vez, desde LAN)

Tras sincronizar los cambios de `deploy/cloudflared/config.yml` y `docker-compose.prod.yml`:

```bash
ssh softone@192.168.1.2
cd /opt/softone-app
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d cloudflared
docker compose -f deploy/docker-compose.prod.yml --env-file .env logs --tail=30 cloudflared
```

## 6. Verificar SSH remoto

Desde tu laptop (con `cloudflared` instalado):

```bash
ssh -o ProxyCommand="cloudflared access ssh --hostname %h" softone@ssh.softone360.com
```

Cloudflare pedirá login la primera vez. Con la clave de deploy + service token, GitHub Actions no necesita login interactivo.
