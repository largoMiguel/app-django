# SoftOne App (Django + React)

Aplicación full-stack lista para producción.

- **Frontend:** React 19 + Vite 6 + Tailwind CSS v4 + TypeScript 5
- **Backend:** Python 3.13 + Django 5.1 + Django REST Framework 3.15 (sólo API, sin vistas server-rendered de negocio)
- **DB:** PostgreSQL 17
- **Auth:** JWT (SimpleJWT) con refresh rotation + blacklist
- **RBAC:** roles sobre `django.contrib.auth.Group` + `Permission` — listo para proteger vistas DRF, URLs y consultas
- **Multi-tenancy:** entidades (municipios/organismos) + secretarías + módulos habilitables por entidad
- **Módulo PQRS:** Gestión de Peticiones, Quejas, Reclamos, Sugerencias y Denuncias (Ley 1755 de 2015)
- **Portal ciudadano:** formulario público por entidad (`/portal/:slug`) sin autenticación
- **IA:** OpenAI (`gpt-4o-mini` por defecto) para extracción y clasificación automática de PQRS a partir de texto o documentos adjuntos
- **Reverse proxy:** Nginx (Docker)
- **Acceso público:** Cloudflare Tunnel (HTTP/2) → `https://app.softone360.com`

URL en producción: **https://app.softone360.com**

---

## Estructura

```
app_django/
├── backend/                       # Django + DRF (sólo API)
│   ├── config/
│   │   ├── settings/              # base.py · dev.py · prod.py
│   │   ├── urls.py
│   │   ├── api_v1.py
│   │   ├── wsgi.py · asgi.py
│   ├── apps/
│   │   ├── accounts/              # User custom (email login) + auth JWT + gestión usuarios
│   │   ├── rbac/                  # Roles + permissions (Group + RoleMeta)
│   │   ├── entities/              # Entidades + Secretarías (multi-tenancy)
│   │   ├── pqrs/                  # Módulo PQRS completo
│   │   │   ├── models.py          # PQRS, AsignacionAuditoria, PQRSArchivo
│   │   │   ├── serializers.py
│   │   │   ├── views.py           # ViewSet + acciones: asignar, responder, auto-create (IA)
│   │   │   ├── public_views.py    # API pública del portal ciudadano
│   │   │   ├── public_urls.py
│   │   │   ├── admin.py
│   │   │   ├── services/
│   │   │   │   └── ai.py          # Extracción de texto (PDF/DOCX/TXT) + llamada OpenAI
│   │   │   └── migrations/
│   │   └── common/
│   │       └── management/commands/bootstrap_app.py
│   ├── requirements.txt · pyproject.toml
│   ├── Dockerfile · docker-entrypoint.sh
│   └── manage.py
├── frontend/                      # React + Vite + Tailwind v4
│   ├── src/
│   │   ├── core/
│   │   │   ├── api/
│   │   │   │   ├── client.ts      # Axios + refresh interceptor
│   │   │   │   ├── pqrs.ts        # API PQRS (list, create, autoCreate, archivos…)
│   │   │   │   └── pqrsPublic.ts  # API portal ciudadano
│   │   │   └── auth/              # store · api · RequireAuth · RequireRole · RequireModule
│   │   ├── features/
│   │   │   ├── auth/LoginPage.tsx
│   │   │   ├── pqrs/              # Dashboard · PQRSPage · Informes · modales · PublicPQRSPortal
│   │   │   ├── users/UsersPage.tsx
│   │   │   └── superadmin/        # EntitiesPage · EntityDetailPage
│   │   └── components/layout/
│   ├── index.html · vite.config.ts · tsconfig.json
│   ├── nginx.conf · Dockerfile
│   └── package.json
├── deploy/
│   ├── docker-compose.prod.yml    # db + backend + frontend + nginx + cloudflared
│   ├── nginx/
│   ├── cloudflared/               # config.yml + config.template.yml
│   └── scripts/
│       ├── server-bootstrap.sh
│       ├── deploy.sh
│       ├── sync.sh
│       └── backup-db.sh
├── docker-compose.dev.yml         # sólo PostgreSQL (dev)
└── .env.example
```

---

## Módulo PQRS

Gestión completa del ciclo de vida de PQRS conforme a la Ley 1755 de 2015.

### Flujo

```
Ciudadano crea PQRS (manual, portal público o vía IA)
  └─→ Estado: RECIBIDA
       └─→ Admin asigna a Secretaría
            └─→ Estado: ASIGNADA
                 ├─→ Secretario responde → Estado: RESPONDIDA → Admin cierra → CERRADA
                 └─→ Secretario rechaza → Estado: RECHAZADA_ASIGNACIÓN → Admin reasigna
```

### Roles que interactúan con PQRS

| Rol | Permisos |
|---|---|
| `superadmin` | Gestión de entidades (crear/editar); **no opera PQRS** |
| `admin` | CRUD PQRS de su entidad, asignar/reasignar, cerrar, reabrir, eliminar adjuntos, usuarios |
| `secretario` | Ver PQRS asignadas a su secretaría, responder, rechazar asignación |
| `ciudadano` | Crear y consultar sus PQRS (si el módulo está habilitado) |

Otros roles del sistema (`contratista`, `auditor`) se crean en bootstrap pero aún no tienen flujos PQRS asignados.

### Endpoints PQRS (autenticados)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/pqrs/stats/` | Agregados para dashboard (conteos por estado, tipo, canal, secretaría) |
| `GET` | `/api/v1/pqrs/` | Listar PQRS (paginado; filtros abajo) |
| `POST` | `/api/v1/pqrs/` | Crear PQRS manual (soporta multipart con `archivos`) |
| `GET/PATCH` | `/api/v1/pqrs/{id}/` | Detalle / editar |
| `DELETE` | `/api/v1/pqrs/{id}/` | Eliminar (admin) |
| `POST` | `/api/v1/pqrs/{id}/asignar/` | Asignar a secretaría `{secretaria_id, justificacion}` |
| `POST` | `/api/v1/pqrs/{id}/rechazar-asignacion/` | Rechazar asignación `{motivo}` |
| `POST` | `/api/v1/pqrs/{id}/responder/` | Responder PQRS (multipart: `respuesta` + `archivo_respuesta`; opcional `enviar_email`) |
| `POST` | `/api/v1/pqrs/{id}/cerrar/` | Cerrar PQRS |
| `POST` | `/api/v1/pqrs/{id}/reabrir/` | Reabrir PQRS respondida |
| `GET/POST` | `/api/v1/pqrs/{id}/archivos/` | Listar / subir archivos adjuntos |
| `DELETE` | `/api/v1/pqrs/{id}/archivos/{aid}/` | Eliminar archivo adjunto (admin) |
| `POST` | `/api/v1/pqrs/auto-create/` | **Crear PQRS con IA** (texto + archivos) |

### Portal ciudadano (público, sin JWT)

Ruta frontend: `/portal/:slug` (ej. `/portal/alcaldia-ejemplo`).

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/public/entity/{slug}/` | Datos de la entidad (nombre, logo, horarios…) |
| `POST` | `/api/v1/public/entity/{slug}/pqrs/` | Crear PQRS manual desde el portal |
| `POST` | `/api/v1/public/entity/{slug}/pqrs/auto/` | Crear PQRS con IA desde el portal |

Rate-limit: `30/hour` por IP en endpoints públicos; `20/hour` por usuario en `POST /api/v1/pqrs/auto-create/` (autenticado).

### Listado PQRS (filtros y paginación)

Query params soportados en `GET /api/v1/pqrs/`:

| Param | Descripción |
|---|---|
| `page`, `page_size` | Paginación (**obligatorio** `page`; default página 1) |
| `search` | Radicado, asunto, nombre o cédula |
| `estado`, `tipo_solicitud`, `assigned_to` | Filtros exactos |
| `fecha_desde`, `fecha_hasta` | Rango de `fecha_solicitud` (informes) |
| `pendientes=true` | Excluye respondidas y cerradas |
| `alerta=true` | Vencen en ≤5 días y siguen abiertas |


- Máximo **4 archivos** por PQRS (campo `archivos` en multipart).
- Ruta de almacenamiento: `media/entities/<entity_id>/pqrs/<pqrs_id>/<nombre_seguro>`.
- Formatos soportados para extracción de texto: PDF, DOCX, TXT, CSV, MD.
- Los archivos se sirven vía `MEDIA_URL=/media/` y requieren **JWT válido** (`ProtectedMediaView`); el frontend usa `downloadAuthenticatedFile` / `openAuthenticatedFile` en lugar de enlaces directos.

---

## IA con OpenAI

La acción `POST /api/v1/pqrs/auto-create/` (y el portal público `/pqrs/auto/`) recibe texto libre y/o archivos y utiliza OpenAI para:

1. Extraer el texto de los documentos adjuntos (PDF → `pdfplumber`/`pypdf`, DOCX → `python-docx`).
2. Construir un prompt estructurado con los campos del modelo PQRS y la lista de secretarías activas de la entidad.
3. Llamar al modelo (`gpt-4o-mini` por defecto) con `response_format: json_object` y `temperature: 0.1`.
4. Normalizar y validar la respuesta.
5. Crear la PQRS y, si la IA detectó la secretaría correcta, asignarla automáticamente.

### Variables de entorno OpenAI

```
OPENAI_API_KEY=sk-...              # obligatoria para auto-create
OPENAI_MODEL=gpt-4o-mini         # opcional, default gpt-4o-mini
```

En producción el backend necesita salida a Internet hacia la API de OpenAI (la red `edge` del compose no es `internal`).

---

## Desarrollo local

### Base de datos (Docker)

```bash
# Levantar PostgreSQL local
docker compose -f docker-compose.dev.yml up -d db
```

### Backend

```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env             # edita credenciales + OPENAI_API_KEY
export DJANGO_SETTINGS_MODULE=config.settings.dev
python manage.py migrate
python manage.py bootstrap_app         # crea roles + superadmin inicial
python manage.py runserver 0.0.0.0:8000
```

API en `http://localhost:8000/api/v1/` · Docs Swagger: `/api/docs/`.

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy /api → :8000)
```

---

## Modelo RBAC

- Usuario (`apps.accounts.User`) → pertenece a uno o varios `Group`.
- Cada `Group` representa un **rol** y tiene su `RoleMeta` (descripción, `is_system`).
- Cada `Group` agrupa N `Permission` de Django (`<app>.<action>_<model>`).
- Roles por defecto creados por `bootstrap_app`:
  - `superadmin` (todos los permisos, no se puede borrar)
  - `admin` (todos los permisos, no se puede borrar)
  - `secretario`, `ciudadano`, `contratista`, `auditor` (sin permisos asignados; añadirlos desde Admin o API)

### Proteger una vista DRF

```python
from apps.rbac.permissions import HasRole, HasPerm, IsAdminRole

class FacturaViewSet(viewsets.ModelViewSet):
    permission_classes = [HasRole("contabilidad", "admin")]

class ReporteViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasPerm("reportes.view_reporte")]
```

### Proteger una ruta en React

```tsx
<Route element={<RequireRole roles={["admin"]} />}>
  <Route element={<RequireModule module="enable_pqrs" />}>
    <Route path="/pqrs" element={<PQRSPage />} />
  </Route>
</Route>
```

`useAuthStore().user.roles`, `permissions` y `enabled_modules` están disponibles para ocultar botones / menús.

### API REST de roles

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/rbac/roles/` | Listar roles |
| `POST` | `/api/v1/rbac/roles/` | Crear rol `{ name, description, permissions: [id…] }` |
| `PATCH` | `/api/v1/rbac/roles/<id>/` | Editar rol |
| `DELETE` | `/api/v1/rbac/roles/<id>/` | Borrar rol (no permitido si `is_system`) |
| `POST` | `/api/v1/rbac/roles/assign/` | Asignar roles a un usuario `{ user_id, role_ids }` |
| `GET` | `/api/v1/rbac/permissions/` | Catálogo de permisos |

Todos requieren rol `admin` o `superadmin`.

---

## Endpoints de autenticación

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/v1/auth/login` | `{ email, password }` → `{ access, refresh, user }` |
| `POST` | `/api/v1/auth/refresh` | `{ refresh }` → `{ access, refresh }` |
| `POST` | `/api/v1/auth/logout` | `{ refresh }` → 205 (blacklistea refresh) |
| `GET` | `/api/v1/auth/me` | usuario actual (incluye roles + permisos + módulos) |
| `POST` | `/api/v1/auth/change-password` | `{ old_password, new_password }` |

---

## Despliegue de cambios (producción)

Repositorio: **git@github.com:largoMiguel/app-django.git** · Servidor: `/opt/softone-app`

### Desplegar con GitHub (recomendado, desde cualquier lugar)

| Rama | Qué pasa al hacer push |
|------|------------------------|
| `development` | CI: tests backend + build frontend |
| `main` | CI + deploy automático a https://app.softone360.com |

```
development (trabajo diario) → PR → main → deploy automático
```

1. Haz commits y PRs hacia `development`.
2. Cuando esté listo, abre PR `development` → `main` y haz merge.
3. GitHub Actions sincroniza el código al servidor y ejecuta `deploy/scripts/deploy.sh`.

### Desplegar manualmente (SSH remoto vía Cloudflare)

Alias en `~/.ssh/config`:

```
Host softone-prod
  HostName ssh.softone360.com
  User softone
  ProxyCommand cloudflared access ssh --hostname %h
```

```bash
deploy/scripts/sync.sh softone-prod
ssh softone-prod 'cd /opt/softone-app && deploy/scripts/deploy.sh'
```

### Desplegar en LAN (misma red que el servidor)

```bash
deploy/scripts/sync.sh softone@192.168.1.2
ssh softone@192.168.1.2 'cd /opt/softone-app && deploy/scripts/deploy.sh'
```

`deploy.sh` hace `build --pull` y `up -d --remove-orphans`. Es seguro re-ejecutarlo en caliente.

### Casos típicos en el servidor

Alias útil (opcional):

```bash
export COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env"
```

| Cambio | Comando |
|---|---|
| Deploy completo | `deploy/scripts/deploy.sh` |
| Sólo backend | `$COMPOSE up -d --build backend` |
| Sólo frontend | `$COMPOSE up -d --build frontend` |
| Sólo Nginx | `$COMPOSE restart nginx` |
| Sólo túnel | `$COMPOSE up -d cloudflared` |
| Migración DB | Automática al arrancar backend. Manual: `$COMPOSE exec backend python manage.py migrate` |
| Variable de entorno | Editar `.env` y `$COMPOSE up -d` |

### Logs y troubleshooting

```bash
ssh softone-prod   # o softone@192.168.1.2 en LAN
cd /opt/softone-app
export COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env"

$COMPOSE ps
$COMPOSE logs -f --tail=100 backend
$COMPOSE logs -f --tail=100 cloudflared
```

**Si `https://app.softone360.com` no responde:**

1. `$COMPOSE ps` — todos los servicios deben estar `Up` y `healthy`.
2. `$COMPOSE logs cloudflared` — errores de credenciales o DNS.
3. `$COMPOSE exec nginx wget -qO- http://127.0.0.1/healthz` — debe devolver `ok`.

### Backups

```bash
ssh softone-prod 'cd /opt/softone-app && deploy/scripts/backup-db.sh'
```

Backups en `/var/backups/softone/softone_YYYYMMDD_HHMMSS.dump`. Retención 14 días.

Restaurar:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env exec -T db \
  pg_restore -U softone -d softone --clean --if-exists \
  < /var/backups/softone/softone_YYYYMMDD_HHMMSS.dump
```

---

## Bootstrap del servidor (Ubuntu Server)

`deploy/scripts/server-bootstrap.sh` deja el servidor recién formateado:

1. Apaga y borra cualquier stack Docker previo (incl. `softone-app` Angular/FastAPI antiguo).
2. Elimina volúmenes, imágenes, redes y servicios systemd legacy.
3. Borra `/opt/softone-app` completo (preserva `~/.cloudflared`).
4. Instala Docker Engine + plugin Compose + UFW + cloudflared CLI.
5. Endurece firewall (sólo SSH entrante).
6. Crea `/opt/softone-app` con permisos correctos.

Uso (desde el servidor):

```bash
scp deploy/scripts/server-bootstrap.sh softone@192.168.1.2:/tmp/
ssh softone@192.168.1.2 'bash /tmp/server-bootstrap.sh'
```

Es **destructivo** y pide confirmación (`SI`) antes de borrar nada.

---

## Seguridad

- TLS termina en Cloudflare; el origen sólo se publica vía túnel (no hay puertos abiertos al Internet).
- UFW activo: sólo SSH (22) entrante.
- Contenedores: `no-new-privileges`, usuario sin privilegios en el backend, redes Docker segmentadas (`internal` para DB/backend, `edge` para nginx ↔ cloudflared/frontend/backend).
- PostgreSQL **no publica puertos** al host.
- Secretos en `.env` (chmod 600), generados con `openssl rand`.
- JWT HS256 (access 30 min / refresh 7 días con rotation + blacklist), hash **Argon2**.
- Headers de seguridad: CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- CORS restringido a `https://app.softone360.com`.
- Mensaje genérico ante credenciales inválidas para no filtrar emails registrados.
- Rate-limit anti brute-force en `/api/v1/auth/login` (Nginx 10r/min + django-ratelimit).
- Validadores de contraseña (longitud mínima 10, no comunes, no numéricas, no similares al usuario).

### CSP en uso (Nginx)

```
default-src 'self';
img-src 'self' data: https:;
style-src 'self' 'unsafe-inline';
script-src 'self';
script-src-attr 'unsafe-inline';
font-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

---

## Variables de entorno (.env)

```
ENV=prod
DEBUG=false
SECRET_KEY=<openssl rand -hex 64>   # obligatoria en prod (sin fallback inseguro)
ALLOW_API_DOCS=false                  # true solo si quieres /api/docs/ en producción
ENABLE_DJANGO_ADMIN=false             # /admin/ deshabilitado por defecto en prod

ALLOWED_HOSTS=app.softone360.com
CORS_ALLOWED_ORIGINS=https://app.softone360.com

POSTGRES_DB=softone
POSTGRES_USER=softone
POSTGRES_PASSWORD=<password fuerte>

INITIAL_ADMIN_EMAIL=admin@softone360.com
INITIAL_ADMIN_PASSWORD=<password fuerte>
INITIAL_ADMIN_NAME=Admin SoftOne

# OpenAI — IA para creación automática de PQRS
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Email — notificaciones al responder PQRS (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=noreply@softone360.com

# Cloudflare Tunnel — credenciales JSON en el servidor (modo config-file)
# CLOUDFLARED_CREDS_DIR=/home/softone/.cloudflared
```

`INITIAL_ADMIN_*` sólo crean el superadmin si no existe un usuario con ese email. `bootstrap_app` se ejecuta en cada arranque del contenedor backend.

---

## Túnel Cloudflare

Túnel existente:

- Nombre: `softone-app`
- UUID: `1b010f95-dd5a-4236-bd6d-a71c6ef79d15`
- DNS app: `app.softone360.com` (CNAME al túnel)
- DNS SSH: `ssh.softone360.com` (CNAME al túnel; acceso protegido con Cloudflare Access)

En este stack el túnel corre como contenedor Docker en modo **config file + credentials JSON** (no token):

- Config: `deploy/cloudflared/config.yml` (montado en el contenedor).
- Credenciales: `~/.cloudflared/1b010f95-dd5a-4236-bd6d-a71c6ef79d15.json` en el host, montadas en `/etc/cloudflared/creds/`.
- Override del directorio: `CLOUDFLARED_CREDS_DIR` en `.env`.

El ingress HTTP apunta a `http://nginx:80`; el ingress SSH apunta a `ssh://host.docker.internal:22` (SSH del host Ubuntu vía `extra_hosts` en Docker Compose).

Comandos útiles:

```bash
ssh softone@192.168.1.2 'cloudflared tunnel info softone-app'
ssh softone@192.168.1.2 'cloudflared tunnel list'

# Métricas del túnel (desde dentro del contenedor)
docker compose -f deploy/docker-compose.prod.yml --env-file .env \
  exec cloudflared wget -qO- http://localhost:2000/metrics
```
