# Beszel — monitoreo del servidor SoftOne

[Beszel](https://beszel.dev/) es un panel ligero para CPU, RAM, disco, red, salud SMART y **métricas por contenedor Docker**. Un agente en `192.168.88.2` cubre **producción y demo** (todos los contenedores del host).

Archivos: `deploy/beszel/docker-compose.yml`, ingress `monitor.softone360.com` en `deploy/cloudflared/config.yml`.

---

## Estado típico (después del primer despliegue)

| Ítem | ¿Hecho? |
|------|---------|
| Hub + agente en verde | Sí (operativo) |
| DNS `monitor.softone360.com` | Verificar en Cloudflare |
| **Cloudflare Access** en `monitor` | Recomendado — pendiente si no lo creaste |
| **Alertas** (Telegram/email/Discord) | Pendiente — configurar en la UI |
| **Backups** de datos Beszel (`beszel_data`) | Pendiente — ver abajo |
| Cambios del repo en **git** (`deploy/beszel/`) | Pendiente si aún no hiciste commit/push |

---

## Qué falta hacer (prioridad)

### 1. Proteger el panel (Access)

Zero Trust → **Access → Applications** → Self-hosted:

- Dominio: `monitor.softone360.com`
- Política **Allow** con tu correo (OTP)

Opcional avanzado: en el hub, `TRUSTED_AUTH_HEADER=Cf-Access-Authenticated-User-Email` y `TRUSTED_PROXY_IPS` con la red del túnel/proxy (ver comentarios en `docker-compose.yml`).

### 2. Notificaciones y alertas

En Beszel → **Settings → Notifications**: conecta Telegram, Discord, SMTP o webhook.

Luego, en cada sistema o reglas globales, alertas sugeridas para SoftOne:

| Alerta | Umbral orientativo | Por qué |
|--------|-------------------|---------|
| Disco **`srv`** (PostgreSQL en `/srv/postgres/…`) | ≥ 85 % | Crecimiento de DB + pgvector |
| Disco **`backups`** (`/var/backups/softone`) | ≥ 90 % | Retención 14 días de dumps |
| Disco **`docker-data`** | ≥ 85 % | Capas de imágenes + logs de contenedores |
| Disco raíz **`/`** | ≥ 85 % | SO y journals |
| **CPU** sostenida | ≥ 90 %, 5–10 min | Celery PDF, imports Excel, SECOP |
| **RAM** | ≥ 90 % | Postgres 3G + backend 4G + workers |
| **Load average** | según cores | Saturación Gunicorn/Celery |
| Contenedor **caído** | cualquiera crítico | Ver lista abajo |
| **SMART** / temperatura | si habilitas SMART | Fallo de NVMe/SSD |

### 3. Contenedores que conviene vigilar

En la pestaña **Docker** del sistema, fíjate sobre todo en:

**Producción (`softone-*`):**

- `softone-db`, `softone-redis`
- `softone-backend`, `softone-celery-worker`, `softone-celery-beat`
- `softone-nginx`, `softone-cloudflared`, `softone-frontend`

**Demo (`softone-demo-*`):** mismo patrón si corre en el mismo host.

**Beszel:** `softone-beszel`, `softone-beszel-agent`.

Beszel puede avisar si un contenedor desaparece o se reinicia mucho; usa nombres exactos en reglas de alerta.

### 4. Comprobaciones “desde fuera” del servidor

Beszel no sustituye un **uptime HTTP** de la app. Complementa con:

- **Cloudflare** → alertas de origen caído / túnel desconectado
- **Beszel hub** → `HEARTBEAT_URL` hacia [Healthchecks.io](https://healthchecks.io), Better Stack o Uptime Kuma (dead man's switch: si Beszel deja de pingear, te avisan)
- Manual ocasional: `curl -s -o /dev/null -w "%{http_code}" https://app.softone360.com/healthz`

### 5. Backup del hub Beszel

Los históricos viven en el volumen Docker `beszel_beszel_data`. Inclúyelo en tu estrategia de backup del host (snapshot de `/var/lib/docker/volumes/` o export periódico desde **Settings → Backups** en Beszel, si usas S3/B2).

### 6. Mantener el repo al día

Tras cambiar `deploy/beszel/docker-compose.yml`, en el servidor:

```bash
cd /opt/softone-app/deploy/beszel
docker compose --env-file .env up -d
```

---

## Qué más podemos monitorizar (capas)

### Ya cubierto con el compose actual

- CPU, RAM, red, load del host
- **Todos los contenedores** vía `docker.sock` (prod + demo + Beszel)
- Discos montados como carpetas extra:
  - **`srv`** — datos PostgreSQL prod/demo
  - **`backups`** — dumps programados
  - **`opt`** — `/opt/softone-app`, `/opt/softone-demo`
  - **`docker-data`** — `/var/lib/docker`
  - **`softone-logs`** — PQRS IMAP, backups, mantenimiento

### En la UI de Beszel (sin tocar código)

- **Logs e inspect** de contenedores (`CONTAINER_DETAILS` activo por defecto)
- **Actualizaciones de imagen** Docker (registry check; desactivar: `DOCKER_IMAGE_CHECK=false`)
- **Gráficas históricas** y export
- **Multi-usuario** si más admins necesitan ver el servidor
- **OAuth** (Google/GitHub) en el hub si quieres desactivar password (`DISABLE_PASSWORD_AUTH`)

### Opcional en el servidor (más setup)

| Capacidad | Cómo | Notas |
|-----------|------|--------|
| **SMART** (salud del disco) | Instalar agente **binario** con `smartctl` o montar `/dev/nvme0n1` + caps en el contenedor | En Docker puro SMART suele ser limitado |
| **Servicios systemd** | `SERVICE_PATTERNS="docker*,ssh,cron*"` en agente binario en el host | El agente en contenedor no ve systemd bien |
| **GPU** | `GPU_COLLECTOR=…` | Solo si el servidor tiene GPU |
| **Ping a Internet** | Alertas de red / caídas en Beszel | Útil si el ISP falla |
| **Excluir ruido** | `EXCLUDE_CONTAINERS="buildx_*"` | Menos contenedores efímeros en la lista |

### Lo que Beszel **no** monitoriza (otras herramientas)

| Necesidad | Alternativa |
|-----------|-------------|
| Errores 500 en Django / trazas | Sentry, logs `$COMPOSE logs backend` |
| Cola Celery atascada | Flower, Redis `LLEN`, métricas custom |
| Latencia Cloudflare → origen | Dashboard CF, logs `cloudflared` |
| Espacio en **Backblaze B2** | Consola B2 / alertas de billing |
| Certificados TLS | Cloudflare (edge); origen no expone TLS público |
| Clerk / OpenAI caídos | Status pages + alertas manuales en la app |

---

## Referencia rápida de despliegue

### Variables del agente (`.env`)

```
BESZEL_APP_URL=https://monitor.softone360.com
BESZEL_AGENT_KEY="ssh-ed25519 AAAA..."   # clave pública del diálogo Add System
BESZEL_AGENT_TOKEN=uuid-del-token       # UUID, NO va en KEY
```

### Comandos

```bash
export BESZEL="docker compose -f /opt/softone-app/deploy/beszel/docker-compose.yml --env-file /opt/softone-app/deploy/beszel/.env"
$BESZEL ps
$BESZEL logs -f --tail=50 beszel-agent
```

### DNS (si falta el CNAME)

Cloudflare → CNAME `monitor` → `1b010f95-dd5a-4236-bd6d-a71c6ef79d15.cfargotunnel.com` (proxied).

---

## Checklist final

- [x] Hub + agente conectados (WebSocket)
- [ ] Cloudflare Access en `monitor`
- [ ] Canal de alertas (Telegram/email/…)
- [ ] Umbrales disco (`srv`, `backups`, `docker-data`, `/`)
- [ ] Alertas contenedores críticos
- [ ] `HEARTBEAT_URL` opcional
- [ ] Backup volumen `beszel_beszel_data`
- [ ] Commit/push de `deploy/beszel/` y `deploy/cloudflared/config.yml`
