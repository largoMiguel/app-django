# Integración Gmail — PQRS (Add-on + OAuth)

Esta integración **coexiste** con el ingreso IMAP (`ingest_pqrs_inbox`) y el envío ZeptoMail existente. No los reemplaza.

## Componentes

| Componente | Descripción |
|---|---|
| **Gmail Add-on (HTTP)** | Radicar el correo abierto como PQRS con vista previa IA editable |
| **OAuth `gmail.send`** | Cada funcionario conecta su Gmail institucional para enviar respuestas |
| **ZeptoMail / IMAP** | Siguen activos si Gmail no está conectado o para ingreso por reenvío |

## Scopes (mínimo privilegio)

**Add-on (funcionario en Gmail):**

- `https://www.googleapis.com/auth/gmail.addons.execute`
- `https://www.googleapis.com/auth/gmail.addons.current.message.action`
- `https://www.googleapis.com/auth/userinfo.email`

No se usan `gmail.readonly`, `gmail.modify` ni `mail.google.com`.

**OAuth envío (app web):**

- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/userinfo.email`

## Google Cloud — configuración

1. Crear proyecto (o usar existente) en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilitar **Gmail API**.
3. Pantalla de consentimiento OAuth (interno Workspace si aplica).
4. Credenciales:
   - **OAuth client (Web)** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - **OAuth client (Add-on)** → `GOOGLE_ADDON_CLIENT_ID` (audience de tokens del add-on)
5. URI de redirección autorizada:
   - Demo: `https://demo.softone360.com/api/v1/integrations/google/callback`
   - Prod: `https://app.softone360.com/api/v1/integrations/google/callback`

## Workspace Add-on HTTP (radicación desde Gmail)

Manifiesto: [`deploy/google-addon/deployment.json`](../deploy/google-addon/deployment.json)

Cada `runFunction` / `onTriggerFunction` debe ser una **URL HTTPS completa** (la API de deployments **no** admite `httpOptions.rootUrl`). Manifiestos:

- Demo: [`deploy/google-addon/deployment.json`](../deploy/google-addon/deployment.json)
- Prod: [`deploy/google-addon/deployment.prod.json`](../deploy/google-addon/deployment.prod.json)

Comprobación rápida (debe responder **200**):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://demo.softone360.com/api/v1/google-addon/gmail/open \
  -H "Content-Type: application/json" -d '{}'
```

### Requisitos en SoftOne (antes de probar en Gmail)

1. Usuario en SoftOne con **el mismo email** que Gmail (admin o secretario).
2. Entidad: **`email_domains`** incluye el dominio del correo (ej. `viracacha-boyaca.gov.co`).
3. Módulos entidad: **PQRS** + **`enable_ai_reports`** (el add-on usa IA en vista previa).
4. OAuth envío ya probado (opcional para radicar; útil para responder después).

### Google Cloud — publicar el add-on HTTP

Proyecto: el mismo del Client ID OAuth (`project-ff608399-0088-434c-b2e` o el suyo).

1. **APIs habilitadas**
   - Gmail API (ya)
   - **Google Workspace Marketplace API**
   - **Google Workspace Add-ons API** (si aparece en la biblioteca)

2. **Pantalla de consentimiento OAuth**
   - Los scopes del add-on van en `deployment.json` (`gmail.addons.execute`, etc.), no hace falta añadirlos a mano en “Editar app” como en `gmail.send`.
   - Sigue en **Prueba**: cada cuenta que use el add-on debe estar en **Usuarios de prueba** (igual que para OAuth web).

3. **HTTP Deployments** (consola)
   - [APIs y servicios](https://console.cloud.google.com/apis/dashboard) → **Google Workspace Marketplace SDK** → pestaña **HTTP Deployments**  
     (o buscar “HTTP Deployments” en el proyecto).
   - **Create new deployment** → nombre ej. `softone-pqrs-demo`.
   - Pegar el JSON de [`deploy/google-addon/deployment.json`](../deploy/google-addon/deployment.json) (demo: `rootUrl` demo).
   - **Submit**.

4. **Client ID del add-on** (audience de `userIdToken` / `systemIdToken`)

   Tras crear el deployment, en la misma pantalla o con Cloud Shell:

   ```bash
   gcloud workspace-add-ons get-authorization --project=TU_PROJECT_ID
   ```

   Copiar el **Client ID** que devuelve Google y ponerlo en el servidor:

   ```env
   GOOGLE_ADDON_CLIENT_ID=<client-id-del-add-on>
   ```

   Reiniciar `demo-backend`. (Si no lo configuras, el backend acepta también `GOOGLE_CLIENT_ID` web; en producción conviene el ID del add-on.)

5. **Instalar en tu cuenta**
   - HTTP Deployments → junto al deployment → **Install**.
   - Inicia sesión con la cuenta institucional de prueba (`@…gov.co`).

6. **Instalar para el municipio (opcional)**
   - Admin de **Google Workspace** del dominio → **Apps** → **Google Workspace Marketplace** → complementos / apps internas, según la UI de su consola.
   - Asignar el add-on a la O.U. de funcionarios que radicarán.

### Uso en Gmail

1. Abrir un **correo** (no solo la bandeja).
2. Panel derecho → icono del complemento **SoftOne PQRS** (o “Complementos”).
3. **RADICAR COMO PQRS** → vista previa IA → editar → confirmar radicación.

Si no aparece el panel: recargar Gmail, comprobar **Install** en GCP y que la cuenta esté en usuarios de prueba.

## Variables de entorno

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://demo.softone360.com/api/v1/integrations/google/callback
GOOGLE_ADDON_SERVICE_ACCOUNT_EMAIL=
GOOGLE_ADDON_CLIENT_ID=
GOOGLE_TOKEN_ENCRYPTION_KEY=   # openssl rand -base64 32
GOOGLE_GMAIL_SEND_ENABLED=false
APP_PUBLIC_URL=https://demo.softone360.com
```

- `GOOGLE_GMAIL_SEND_ENABLED=false` por defecto: nadie cambia de ZeptoMail hasta activarlo.
- `GOOGLE_TOKEN_ENCRYPTION_KEY`: cifra `refresh_token` en PostgreSQL (Fernet).

## Entidad por dominio

Campo **`Entity.email_domains`** (CSV), ej. `chiquiza-boyaca.gov.co`.

Al radicar desde Gmail:

1. Email del funcionario desde `userIdToken` verificado.
2. Dominio → entidad candidata.
3. **Intersección** con membresías activas del usuario (`UserEntityMembership`).
4. Si no hay match → membresía `is_default`.

Nunca se acepta `entity_id` desde Gmail o el cliente.

## Flujo de radicación (Add-on)

```mermaid
sequenceDiagram
  participant Gmail
  participant API as Backend_API
  participant IA as OpenAI
  participant DB as PostgreSQL

  Gmail->>API: POST gmail/open (sin leer cuerpo)
  API-->>Gmail: Tarjeta RADICAR COMO PQRS
  Gmail->>API: POST gmail/preview + tokens
  API->>Gmail: GET message (accessToken temporal)
  API->>IA: extraer_pqrs_con_ia
  API-->>Gmail: Tarjeta editable + preview_token
  Gmail->>API: POST gmail/radicate
  API->>Gmail: GET message + adjuntos
  API->>DB: crear_pqrs_desde_email + PQRSGmailOrigin
  API-->>Gmail: PQRS radicada + enlace
```

Idempotencia: `UNIQUE (gmail_account_email, gmail_message_id)` en `pqrs_gmail_origins`.

## Flujo de respuesta (OAuth)

1. Funcionario → **Configuración → Correo institucional** (`/configuracion/correo`).
2. `POST /api/v1/integrations/google/connect` (Clerk) → redirect Google.
3. Callback guarda `refresh_token` cifrado en `google_email_connections`.
4. Al responder PQRS con **Notificar por email**:
   - Si hay conexión Gmail activa → `users.messages.send` **antes** de marcar `RESPONDIDA`.
   - Si no → ZeptoMail (comportamiento anterior).

Threading: si existe `PQRSGmailOrigin`, se envían `threadId`, `In-Reply-To`, `References` y `Re: asunto`.

## API OAuth (autenticado Clerk)

| Método | Ruta |
|---|---|
| POST | `/api/v1/integrations/google/connect` |
| GET | `/api/v1/integrations/google/callback` |
| GET | `/api/v1/integrations/google/status` |
| DELETE | `/api/v1/integrations/google/disconnect` |

## Solución de problemas

| Síntoma | Causa probable | Acción |
|---|---|---|
| Add-on: usuario no registrado | Email Google ≠ usuario en SoftOne | Crear usuario con mismo email |
| Add-on: IA no habilitada | `enable_ai_reports=false` | Superadmin → módulos entidad |
| Entidad ambigua | Varios dominios / membresías | Completar `email_domains` y membresía default |
| Envío: reautorización | `invalid_grant` / 401 | Reconectar en `/configuracion/correo` |
| Adjunto omitido en add-on | Límite token temporal add-on | Documentado en tarjeta; reenviar por IMAP si crítico |
| Sigue ZeptoMail | `GOOGLE_GMAIL_SEND_ENABLED=false` o sin conexión | Activar flag + conectar Gmail |

## Tests

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py test apps.google_integration
```

## Publicación Marketplace

1. Completar ficha de listing (privacidad, scopes justificados).
2. Revisión Google (add-on + OAuth).
3. Publicar versión de producción con `rootUrl` de `app.softone360.com`.
