# SoftOne App (Django + React)

Aplicación full-stack lista para producción.

- **Frontend:** React 19 + Vite 6 + Tailwind CSS v4 + TypeScript 5
- **Backend:** Python 3.13 + Django 5.1 + Django REST Framework 3.15 (sólo API, sin vistas server-rendered de negocio)
- **DB:** PostgreSQL 17
- **Auth:** Clerk en español (login, invitaciones, revocación de sesión en vivo) + Django RBAC (roles, permisos, módulos por entidad)
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
│   │   ├── accounts/              # User custom (email) + auth Clerk + gestión usuarios
│   │   ├── rbac/                  # Roles + permissions (Group + RoleMeta)
│   │   ├── entities/              # Entidades + Secretarías (multi-tenancy)
│   │   ├── pdm/                   # Módulo PDM + chat IA público
│   │   │   ├── chat_tools.py      # Consultas read-only acotadas por entidad
│   │   │   ├── chat_service.py    # Orquestador OpenAI tool-calling
│   │   │   ├── public_chat_views.py · public_chat_urls.py
│   │   │   └── models.py          # Productos, actividades, chat conversations
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
│   │   │   │   ├── client.ts      # Axios + token Clerk por petición
│   │   │   │   ├── pqrs.ts        # API PQRS (list, create, autoCreate, archivos…)
│   │   │   │   └── pqrsPublic.ts  # API portal ciudadano
│   │   │   └── auth/              # store · api · RequireAuth · RequireRole · RequireModule (Clerk session)
│   │   ├── features/
│   │   │   ├── auth/LoginPage.tsx
│   │   │   ├── pdmchat/           # PublicPdmChatPage (chat IA PDM público)
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

### Portal ciudadano (público, sin autenticación)

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
- Ruta de almacenamiento (B2 `softone-pqrs`):
  - Solicitud (adjuntos ciudadano): `entities/<entity_id>/<numero_radicado>/solicitud/<nombre_seguro>`
  - Respuesta (adjunto secretaría): `entities/<entity_id>/<numero_radicado>/respuesta/<nombre_seguro>`
  - Ejemplo: `entities/1/PQRS-1-20260608-001/solicitud/documento.pdf`
- Formatos soportados para extracción de texto: PDF, DOCX, TXT, CSV, MD.
- Los archivos se sirven vía `MEDIA_URL=/media/` y requieren **token Clerk válido** (`ProtectedMediaView`); el frontend usa `downloadAuthenticatedFile` / `openAuthenticatedFile` en lugar de enlaces directos.

### Ingreso automático por correo (IMAP)

Un admin o secretario **reenvía** la PQRS desde su correo institucional (`*.gov.co`) al buzón `pqrssoftone@gmail.com`. Un cron lee el buzón por IMAP cada 3 minutos y:

1. Valida que el remitente (`From`) sea un **usuario registrado** en la plataforma con rol `admin` o `secretario` y entidad asignada (correo del usuario en Usuarios).
2. Opcionalmente exige dominio `.gov.co` (`PQRS_INBOUND_REQUIRE_GOVCO=true`).
3. Extrae texto y adjuntos del correo reenviado.
4. Usa **OpenAI** (`extraer_pqrs_con_ia`) para estructurar y clasificar la PQRS.
5. Crea la PQRS con `canal_llegada=email`, adjuntos y asignación automática a secretaría (IA; fallback: secretaría del usuario que reenvió).
6. Envía confirmación de radicación al ciudadano si hay email.

Correos de remitentes no registrados se **ignoran** (aunque sean `gov.co`). Cada `Message-ID` se registra en `CorreoEntrantePQRS` para idempotencia.

Antes de la IA, el sistema extrae el cuerpo reenviado, lee el **From/De original** del bloque reenviado (ej. `amadolargo@gmail.com` o `concejo@otro-municipio.gov.co`) y lo usa como `email_ciudadano` y `medio_respuesta=email`. Solo se ignoran el correo del funcionario que reenvía y la bandeja institucional de **esta** entidad (ej. `gobierno@chiquiza-boyaca.gov.co` en To). Otros `@*.gov.co` de entidades distintas sí se conservan como solicitante. Si hay varios correos del solicitante en el hilo, se guardan separados por coma.

**Comando manual:**

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env exec -T backend \
  python manage.py ingest_pqrs_inbox
```

**Variables (.env):**

```
PQRS_INBOUND_ENABLED=true
PQRS_INBOUND_REQUIRE_GOVCO=true
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=pqrssoftone@gmail.com
IMAP_PASSWORD=<app-password-gmail>
IMAP_MAILBOX=INBOX
```

Log del cron: `logs/softone-pqrs-inbox.log` (en `/opt/softone-app/logs/`).

---

## Módulo PDM — Exportar PIIP

Desde el menú **Acciones** del PDM (rol `admin`), la opción **Exportar PIIP** genera y descarga un Excel (`.xlsx`) con productos que tienen BPIN y meta programada en el año indicado. El archivo **no se guarda** en el servidor ni queda historial. Si un producto tiene varios BPIN (separados por coma), o varias fuentes presupuestales, se genera **una fila por cada BPIN y por cada fuente**. Las fuentes se normalizan al catálogo PIIP (Propios, SGP - Salud, …, Otros).

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/pdm/v2/{slug}/export-piip?anio=2026` | Descarga `PIIP_{slug}_{anio}.xlsx` (encabezados verde `#6AA84F`, texto blanco) |

Query param `anio` (opcional): año de seguimiento; por defecto el año actual. El frontend usa el año del filtro de productos (`filtroAnio`) cuando está en la vista de productos; en dashboard usa el año por defecto del estado (año actual).

---

## Módulo Chat IA del PDM (público)

Chat ciudadano **sin autenticación** para consultar el Plan de Desarrollo Municipal de cada entidad en **tiempo real** (datos leídos directamente de PostgreSQL vía herramientas OpenAI). Un chat por entidad; solo responde sobre el PDM de esa entidad.

### Activación (superadmin)

En **Superadmin → Entidad → Módulos**, activar **Chat IA del PDM (público)** (`enable_pdm_chat`). Requiere que el módulo **PDM** (`enable_pdm`) también esté activo. Al guardar, se generan automáticamente el mensaje de bienvenida y preguntas sugeridas.

La sección **Chat IA del PDM** muestra:
- URL pública: `https://app.softone360.com/chat/{slug}`
- URL LAN: `http://{IP}:{LAN_HTTP_PORT}/chat/{slug}`
- Snippet de embed para sitios gov.co
- Analítica de preguntas (últimos 30 días)

### Rutas públicas

| Ruta | Descripción |
|---|---|
| `/chat/:slug` | Widget de chat (SPA React, modo `?embed=1` para iframe) |
| `/embed/pdm-chat.js` | Launcher JS (botón flotante + iframe) para gov.co |

### Endpoints API públicos

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/public/entity/{slug}/pdm-chat/info/` | Info del chat (logo, intro, sugerencias) |
| `POST` | `/api/v1/public/entity/{slug}/pdm-chat/` | Enviar mensaje `{message, conversation_id?}` → `{reply, sources[]}` |

Rate-limit: `60/hour` por IP (`pdm_chat_public`).

### Analítica (autenticado)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/pdm/v2/{slug}/chat/analytics/` | Conversaciones, mensajes y últimas preguntas (30 días) |

Requiere rol `admin` de la entidad o `superadmin`.

### Embed en gov.co

```html
<script src="https://app.softone360.com/embed/pdm-chat.js" data-entity="slug-de-la-entidad"></script>
```

Opciones: `data-position="bottom-left"`, `data-color="#3eafd4"`, `data-base="https://app.softone360.com"`.

### Guardrails

- Solo responde sobre el PDM de la entidad del slug (rechaza otras entidades y módulos).
- Datos exclusivamente de herramientas read-only acotadas por `entity_id` (productos, ejecución, contratos, actividades, evidencias con URL externa, iniciativas SGR).
- Citación de fuentes: códigos de producto, BPIN (datos.gov.co), URLs de evidencia.
- Conversaciones registradas para analítica (IP hasheada, sin datos personales).

### Variables de entorno

```
PDM_CHAT_OPENAI_API_KEY=sk-...     # obligatoria — API key dedicada al chat PDM (separada de PQRS)
PDM_CHAT_MODEL=gpt-4o-mini         # opcional; por defecto usa OPENAI_MODEL
```

`OPENAI_API_KEY` sigue siendo **solo para PQRS** (auto-create). El chat PDM no la usa.

> **Seguridad:** nunca commits API keys al repositorio. Configúralas solo en `.env` del servidor.

---

## IA con OpenAI

La acción `POST /api/v1/pqrs/auto-create/` (y el portal público `/pqrs/auto/`) recibe texto libre y/o archivos y utiliza OpenAI para:

1. Extraer el texto de los documentos adjuntos (PDF → `pdfplumber`/`pypdf`, DOCX → `python-docx`).
2. Construir un prompt estructurado con los campos del modelo PQRS y la lista de secretarías activas de la entidad.
3. Llamar al modelo (`gpt-4o-mini` por defecto) con `response_format: json_object` y `temperature: 0.1`.
4. Normalizar y validar la respuesta.
5. Crear la PQRS y, si la IA detectó la secretaría correcta, asignarla automáticamente.

La opción **Automática / IA** en el formulario interno y en el portal público solo se muestra si la entidad tiene habilitado el módulo `enable_ai_reports` (Reportes con IA).

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

**Secretario:** `enabled_modules` vacío = **ningún** módulo (debe asignarse explícitamente en Usuarios). Admin: lista vacía = todos los módulos activos de la entidad.

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

El login, logout y cambio de contraseña los gestiona **Clerk** (`<SignIn>` en español). La sesión se valida en cada petición API; si la cuenta está inhabilitada o se revoca la sesión en Clerk, la app cierra sesión y muestra un aviso en `/login`. Django expone el perfil local (roles, permisos, módulos):

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/auth/me` | Usuario actual (requiere token de sesión Clerk en `Authorization: Bearer`) |

Webhook Clerk (público, verificado con firma Svix):

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/v1/webhooks/clerk` | Sincroniza `user.created`, `user.updated`, `user.deleted` con Django |

Los usuarios se crean desde superadmin/admin vía `POST /api/v1/users/` (también aprovisionados en Clerk con password o invitación `{ invite: true }`).

Desactivar o eliminar usuarios:

| Método | Endpoint | Descripción |
|---|---|---|
| `DELETE` | `/api/v1/users/{id}/` | Desactiva en Django y banea en Clerk (reversible) |
| `DELETE` | `/api/v1/users/{id}/?purge=true` | Elimina permanentemente en Django y Clerk |

### Configuración requerida en Clerk Dashboard

Para invitaciones, nombres y acceso restringido:

1. **User & authentication → Email address:** habilitar Email con Password (o código de verificación).
2. **Personal information → Name:** habilitar para sincronizar nombres.
3. **Restrictions → Sign-up mode:** `Restricted` (solo usuarios invitados o creados por admin).

---

## Despliegue: producción + demo en paralelo

Repositorio: **git@github.com:largoMiguel/app-django.git**

| Entorno | Rama | URL | Ruta servidor | LAN |
|---|---|---|---|---|
| **Producción** | `main` | https://app.softone360.com | `/opt/softone-app` | `:8080` |
| **Demo** | `development` | https://demo.softone360.com | `/opt/softone-demo` | `:8081` |

Archivos firmados:

| Entorno | Worker | Bucket(s) B2 |
|---|---|---|
| Prod | https://files.softone360.com | `softone-pqrs`, `softone-pdm`, `softone-th`, `softone-correspondence` |
| Demo | https://files-demo.softone360.com | `storage-demo` (todos los módulos) |

Demo y prod comparten el **mismo servidor** (`192.168.1.2`) y el **mismo par B2** (`B2_KEY_ID` / `B2_APP_KEY`); solo cambian bucket y signing key. Merge `development` → `main` no migra archivos entre buckets.

**Importante:** `deploy/cloudflared/config.yml` y el regex de buckets en `deploy/nginx/conf.d/app.conf` los monta el stack de **producción**. Deben ser **idénticos en `main` y `development`**; si un deploy de `main` los sobrescribe sin las entradas demo, `demo.softone360.com` deja de responder.

Clerk demo: usar `pk_test_` / `sk_test_` de la instancia development. `CLERK_JWT_KEY` debe ser el PEM del JWKS de esa instancia (`*.clerk.accounts.dev`), **no** el de producción. El webhook (`CLERK_WEBHOOK_SIGNING_SECRET`) es opcional en demo: el login funciona sin él; los usuarios se crean vía `POST /api/v1/users/`.

### GitHub Actions

| Rama / evento | GitHub Actions |
|---------------|----------------|
| Push a `development` | CI + deploy automático demo → https://demo.softone360.com |
| PR hacia `main` | CI: tests backend + build frontend |
| Push a `main` | Tests → deploy prod → smoke https://app.softone360.com |

```
development (push → deploy demo) → PR → main (tests + deploy prod)
```

### Bootstrap demo (una vez en el servidor)

```bash
sudo mkdir -p /opt/softone-demo
# Copiar .env.demo.example → /opt/softone-demo/.env
# Completar: SECRET_KEY, POSTGRES_PASSWORD, B2_KEY_ID, B2_APP_KEY (mismos que prod),
# FILE_DELIVERY_SIGNING_KEY (distinto a prod), CLERK_* (instancia development)
cd /opt/softone-demo && bash deploy/scripts/deploy-demo.sh
```

`deploy-demo.sh` verifica el ingress demo en cloudflared prod y solo reinicia el túnel si falta.

### Cloudflare (demo)

DNS + túnel (desde máquina con `CLOUDFLARE_API_TOKEN`):

```bash
export CLOUDFLARE_API_TOKEN=...
bash deploy/scripts/setup-cloudflare-demo-dns.sh
```

Worker demo (`storage-demo`):

```bash
bash deploy/scripts/deploy-cloudflare-worker-demo.sh /opt/softone-demo/.env
```

Tras actualizar `deploy/cloudflared/config.yml` (ingress `demo` / `files-demo` → `softone-demo-nginx`), `deploy-demo.sh` lo sincroniza a prod si hace falta. Manual:

```bash
cd /opt/softone-app/deploy
docker compose -f docker-compose.prod.yml --env-file ../.env restart cloudflared
```

### Desplegar manualmente demo (LAN)

```bash
deploy/scripts/sync-demo.sh softone@192.168.1.2
ssh softone@192.168.1.2 'cd /opt/softone-demo && deploy/scripts/deploy-demo.sh'
# LAN: http://192.168.1.2:8081
```

---

## Despliegue de cambios (producción)

Servidor prod: `/opt/softone-app`

**Sincronizar ramas tras merge:**

```bash
git push origin development
git checkout main && git pull origin main && git merge development && git push origin main
git checkout development && git merge main && git push origin development
```

### Cloudflare Worker (archivos firmados)

Los anexos PQRS/PDM/Asistencia/Correspondencia se sirven vía `https://files.softone360.com`. Tras cambiar buckets o el worker, redeploy desde tu máquina (requiere Node.js):

```bash
bash deploy/scripts/deploy-cloudflare-worker-from-prod.sh
```

Alternativa con `.env` local completo: `bash deploy/scripts/deploy-cloudflare-worker.sh`

Worker demo: `bash deploy/scripts/deploy-cloudflare-worker-demo.sh /opt/softone-demo/.env`

### Acceso SSH al servidor

| Método | Cuándo usarlo | Comando |
|---|---|---|
| **LAN** | Misma red que el servidor (oficina/casa) | `ssh softone@192.168.1.2` |
| **Cloudflare** | Desde cualquier red (requiere Access) | `ssh softone-prod` |

**Servidor de producción:** IP LAN `192.168.1.2` · usuario `softone` · ruta app `/opt/softone-app`

La autenticación SSH usa **clave** (`deploy/keys/softone_deploy`). La contraseña del usuario del sistema no es necesaria para deploy ni administración habitual.

#### Configurar SSH remoto en macOS

1. Instalar `cloudflared` CLI (no basta con la app WARP):

```bash
mkdir -p ~/bin
# Descargar el binario desde https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# o copiarlo a ~/bin/cloudflared y chmod +x
export PATH="$HOME/bin:$PATH"   # añadir a ~/.zshrc
```

2. Alias en `~/.ssh/config`:

```
Host softone-prod
  HostName ssh.softone360.com
  User softone
  IdentityFile /ruta/a/app_django/deploy/keys/softone_deploy
  StrictHostKeyChecking accept-new
  ProxyCommand ~/bin/cloudflared access ssh --hostname %h
```

3. Verificar:

```bash
ssh softone-prod 'hostname'    # debe responder: softone
```

**Si SSH falla:**

| Síntoma | Causa probable | Solución |
|---|---|---|
| `cloudflared: command not found` | CLI no instalado o no está en PATH | Instalar en `~/bin` y actualizar `ProxyCommand` |
| `Permission denied` con contraseña | El servidor espera clave SSH | Usar la clave de deploy o `ssh softone@192.168.1.2` en LAN |
| `Broken pipe` / timeout remoto | Túnel Cloudflare reconectando | Esperar 1 min o conectar por LAN |
| `softone-prod` no resuelve | Falta alias SSH | Crear entrada en `~/.ssh/config` |

### Desplegar manualmente (SSH remoto vía Cloudflare)

```bash
deploy/scripts/sync.sh softone-prod
ssh softone-prod 'cd /opt/softone-app && deploy/scripts/deploy.sh'
```

### Desplegar en LAN (misma red que el servidor)

Nginx publica HTTP en el host en el puerto `LAN_HTTP_PORT` (por defecto **8080**). Ajusta `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` con la IP LAN (ej. `192.168.1.2`).

```bash
deploy/scripts/sync.sh softone@192.168.1.2
ssh softone@192.168.1.2 'cd /opt/softone-app && deploy/scripts/deploy.sh'
# App en LAN: http://192.168.1.2:8080
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
2. `$COMPOSE logs cloudflared` — errores de credenciales, DNS o timeouts QUIC al arrancar.
3. `$COMPOSE exec nginx wget -qO- http://127.0.0.1/healthz` — debe devolver `ok`.

**Si la app responde lento por Internet pero rápido en LAN:**

El servidor en LAN suele responder en ~1 ms (`/healthz`). La latencia por Internet (~500–800 ms en el primer byte) proviene del **ruteo de Cloudflare** (tráfico de usuario → edge global → túnel → origen), no del ancho de banda del servidor.

Diagnóstico rápido:

```bash
# En el servidor (debe ser ~1 ms)
curl -s -o /dev/null -w "LAN: %{time_starttransfer}s\n" http://127.0.0.1:8080/healthz

# Desde tu Mac (incluye Cloudflare + túnel)
curl -s -o /dev/null -w "Internet: %{time_starttransfer}s\n" https://app.softone360.com/healthz
```

Si LAN es rápido e Internet lento, el origen está bien. Revisa `$COMPOSE logs cloudflared` por errores `Failed to dial a quic connection` (UDP 7844 bloqueado por el ISP/router). El túnel está configurado con `protocol: http2` para evitar esos timeouts al reiniciar.

Mejoras adicionales posibles (Cloudflare Dashboard): Argo Smart Routing, reglas de caché para `/assets/*`.

### Backups

```bash
ssh softone-prod 'cd /opt/softone-app && deploy/scripts/backup-db.sh'
```

Backups en `/var/backups/softone/softone_YYYYMMDD_HHMMSS.dump`. Retención 14 días. Log del cron: `/opt/softone-app/logs/softone-backup.log`.

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
- Clerk verifica tokens de sesión (JWKS / `CLERK_JWT_KEY` opcional); Django mapea `clerk_id` → usuario local con RBAC.
- Redis en producción: caché compartida y rate-limit DRF entre workers Gunicorn.
- Archivos estáticos servidos por Nginx (`/static/`); media protegida sigue en Django con token Clerk.
- Headers de seguridad: CSP (incluye `clerk.softone360.com`, `files.softone360.com`, Cloudflare Insights), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- CORS restringido a orígenes en `CORS_ALLOWED_ORIGINS` (prod: `https://app.softone360.com`, `https://softone360.com`).
- Contraseñas y MFA se gestionan en Clerk; Django usa `set_unusable_password()` para usuarios de app.

### CSP en uso (Nginx)

```
default-src 'self';
img-src 'self' data: blob: https:;
style-src 'self' 'unsafe-inline';
script-src 'self' https://clerk.softone360.com https://challenges.cloudflare.com;
script-src-attr 'unsafe-inline';
font-src 'self' data:;
connect-src 'self' https://clerk.softone360.com https://files.softone360.com;
worker-src 'self' blob:;
frame-src https://challenges.cloudflare.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

---

## Variables de entorno (.env)

Referencia completa en `.env.example`. Resumen de producción:

```
ENV=prod
DEBUG=false
SECRET_KEY=<openssl rand -hex 64>   # obligatoria en prod (sin fallback inseguro)
ALLOW_API_DOCS=false
ENABLE_DJANGO_ADMIN=false

ALLOWED_HOSTS=app.softone360.com,softone360.com,files.softone360.com
CORS_ALLOWED_ORIGINS=https://app.softone360.com,https://softone360.com

POSTGRES_DB=softone
POSTGRES_USER=softone
POSTGRES_PASSWORD=<password fuerte>

INITIAL_ADMIN_EMAIL=admin@softone360.com
INITIAL_ADMIN_PASSWORD=<password fuerte>
INITIAL_ADMIN_NAME=Admin SoftOne

# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_AUTHORIZED_PARTIES=https://app.softone360.com
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# OpenAI (PQRS, informes PDF, chat PDM)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
PDM_CHAT_OPENAI_API_KEY=
PQRS_REPORTS_OPENAI_API_KEY=

# ZeptoMail — correos PQRS (radicación + respuesta)
PQRS_EMAIL_ENABLED=true
ZEPTOMAIL_TOKEN=Zoho-enczapikey ...
ZEPTOMAIL_FROM_EMAIL=noreply@softone360.com
ZEPTOMAIL_WEBHOOK_SECRET=

# PQRS ingreso IMAP (opcional)
PQRS_INBOUND_ENABLED=false

# Backblaze B2 — archivos por módulo
USE_B2_STORAGE=true
B2_KEY_ID=
B2_APP_KEY=
B2_BUCKET_PQRS=softone-pqrs
B2_BUCKET_PDM=softone-pdm
B2_BUCKET_ASISTENCIA=softone-th
# Reconocimiento facial asistencia (distancia L2 face-api.js; default 0.6)
# ASISTENCIA_FACE_MATCH_THRESHOLD=0.6
B2_BUCKET_CORRESPONDENCIA=softone-correspondence
B2_BUCKET_DB=softone-db

# Entrega firmada vía Cloudflare Worker
FILE_DELIVERY_BASE_URL=https://files.softone360.com
FILE_DELIVERY_SIGNING_KEY=<openssl rand -hex 32>
FILE_DELIVERY_TTL=600

# Cloudflare API (solo deploy del Worker files)
# CLOUDFLARE_API_TOKEN=

# Redis / Celery (inyectado por docker-compose en prod)
# REDIS_URL=redis://redis:6379/0

# Gunicorn (opcional)
# GUNICORN_WORKERS=5
# GUNICORN_THREADS=4
```

`INITIAL_ADMIN_*` sólo crean el superadmin si no existe un usuario con ese email. Migraciones y `bootstrap_app` se ejecutan en el contenedor **backend** (Celery omite migraciones).

**Base de datos:** producción y CI usan PostgreSQL con extensión **pgvector** (`pgvector/pgvector:pg17`) para embeddings (módulo IA) y plantillas faciales de asistencia (HNSW + distancia L2).

**CI backend:** además de Postgres, los workflows levantan **Redis** (`redis:7-alpine`) porque Celery encola indexación de embeddings al crear PQRS en tests.

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

**Tuning de rendimiento** (`deploy/cloudflared/config.yml`):

- `protocol: http2` — conexión estable al edge (evita timeouts QUIC si UDP:7844 está bloqueado).
- `ha-connections: 4` — múltiples conexiones persistentes al edge de Cloudflare.
- `originRequest.keepAliveConnections: 100` — reutiliza conexiones hacia Nginx.

Tras cambiar la config del túnel: `$COMPOSE restart cloudflared`.

**Nginx** (`deploy/nginx/conf.d/app.conf`): assets con hash en `/assets/*` llevan `Cache-Control: public, immutable` (1 año) para reducir recargas en visitas repetidas.

Comandos útiles:

```bash
ssh softone@192.168.1.2 'cloudflared tunnel info softone-app'
ssh softone@192.168.1.2 'cloudflared tunnel list'

# Métricas del túnel (desde dentro del contenedor)
docker compose -f deploy/docker-compose.prod.yml --env-file .env \
  exec cloudflared wget -qO- http://localhost:2000/metrics
```
