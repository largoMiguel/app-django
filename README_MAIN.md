# Guía: demo → producción (`main`)

Documento de referencia para **cuándo aplicar migraciones** y **qué hacer el día que se decida subir a producción** todo lo que hoy solo está en demo.

> **Estado al 4 ago 2026 (actualizado)**
>
> | Rama | Commit destacado | URL | Qué incluye |
> |------|------------------|-----|-------------|
> | `development` | `bfb489a` | https://demo.softone360.com | Multi-entidad + SECOP + **Planes Institucionales (D612)** + **Informes seguimiento PDF** (IA, purga 7 días) |
> | `main` | `d25474c` | https://app.softone360.com | **Solo** fix asistencia (token kiosk estable, sin desvincular en kiosco) |

Prod y demo **no están alineados en funcionalidad**. Eso es intencional hasta validar en demo.

---

## ¿Cuándo se aplican las migraciones?

### Respuesta corta

**No hace falta correr `migrate` a mano en el flujo normal.** Cada vez que el contenedor `backend` arranca, el entrypoint lo hace solo:

```33:33:backend/docker-entrypoint.sh
gosu appuser python manage.py migrate --noinput
```

Eso ocurre en:

1. **Push a `development`** → GitHub Actions despliega demo → `deploy-demo.sh` hace `docker compose up -d` → el backend demo reinicia → **migrate automático**.
2. **Push a `main`** (cuando llegue el día) → mismo flujo en prod con `deploy.sh`.

### Demo (ahora)

Tras el push de `development` con multi-entidad, **las migraciones deberían haberse aplicado solas** en el primer arranque del backend demo.

Para **comprobar** en el servidor (SSH al host demo `/opt/softone-demo`):

```bash
cd /opt/softone-demo
export COMPOSE="docker compose -f deploy/docker-compose.demo.yml --env-file .env"

# Ver qué migraciones están aplicadas
$COMPOSE exec demo-backend python manage.py showmigrations accounts pqrs pdm entities planes

# Deberían estar marcadas [X] al menos:
#   accounts  0009_multi_entity_delegation
#   accounts  0010_backfill_memberships
#   pqrs      0016_multi_entity_delegation
#   pdm       0006_multi_entity_delegation
#   entities  0005_multi_entity_delegation   (cambio menor de campo id)
#   entities  0006_entity_secop_nits         (NIT SECOP I/II — aditiva, sin riesgo)
#   planes    0001_initial                   (5 tablas Planes Institucionales D612)
#   planes    0002_seed_catalogo_decreto612  (12 planes globales Decreto 612)
#   planes    0006_informe_plan              (informes PDF async D612, retención 7 días)
```

Si alguna sale `[ ]` (pendiente), forzar una vez:

```bash
$COMPOSE exec demo-backend python manage.py migrate --noinput
```

Luego revisar logs:

```bash
$COMPOSE logs demo-backend --tail 80
```

### Producción (hoy)

Prod **no necesita** esas migraciones todavía: el código en `main` no las usa. Solo tiene el fix de asistencia **sin migración de base de datos**.

---

## Qué cambia en base de datos (cuando subas el resto a prod)

| App | Migración | Qué hace |
|-----|-----------|----------|
| `accounts` | `0009_multi_entity_delegation` | Tabla `UserEntityMembership`, rol `contratista`, supervisor |
| `accounts` | `0010_backfill_memberships` | Crea una membresía por cada usuario existente desde `User.entity` |
| `pqrs` | `0016_multi_entity_delegation` | M2M `assigned_users` en PQRS |
| `pdm` | `0006_multi_entity_delegation` | FK `responsable_usuario` en producto y actividad |
| `entities` | `0005_multi_entity_delegation` | Ajuste de campo (sin datos nuevos relevantes) |
| `entities` | `0006_entity_secop_nits` | Campos opcionales `nit_secop_i`, `nit_secop_ii` para consulta SECOP |
| `planes` | `0001_initial` | Tablas: catálogo, planes, actividades, evidencias, archivos (aditivo, sin riesgo) |
| `planes` | `0002_seed_catalogo_decreto612` | Siembra idempotente de los 12 planes del Decreto 612 (globales, `entity=NULL`) |
| `planes` | `0006_informe_plan` | Tabla `planes_informes` (informes PDF async con expiración 7 días) |

La `0010` es **idempotente en espíritu**: solo inserta membresías donde no existen. Los usuarios actuales siguen con `User.entity` como caché de la membresía por defecto.

**Nota:** `enable_planes_institucionales` ya existe en `entities/0001_initial`; **no** requiere migración adicional de entidades.

**Sin migración nueva** en los fixes de jul 2026 posteriores (delegación por secretaría, listado contratistas, modal entidad): solo cambios de API/UI/permisos sobre tablas ya existentes.

**No hay migración** en el fix de asistencia ya desplegado en prod.

La migración `entities/0006_entity_secop_nits` solo agrega dos campos nullable; es segura en prod cuando se mergee el módulo SECOP.

---

## Checklist: validar en demo (antes de tocar prod)

Hacer en https://demo.softone360.com con usuarios reales de prueba:

- [ ] Login una columna y **modal de entidad** si el usuario tiene varias membresías (cambiar entidad = cerrar sesión)
- [ ] Crear usuario nuevo y **agregar admin existente de otra entidad** (diálogo de confirmación)
- [ ] **Admin** crea contratista asignándolo a una **secretaría** (no elige supervisor usuario)
- [ ] **Secretario** ve módulo Usuarios → lista **sus contratistas** (misma secretaría)
- [ ] Secretario crea/edita contratista; módulos limitados; cascada al quitar módulo al secretario
- [ ] PQRS: admin asigna secretaría → **secretario** delega a contratista → contratista responde solo las suyas
- [ ] PDM: admin asigna secretaría → **secretario** asigna/quita contratista en dropdown ("Sin asignar")
- [ ] Dashboard PQRS secretario: tabla “Delegación a contratistas”
- [ ] Listado API `GET /users/?role=contratista` filtra por membresía en entidad activa
- [ ] Kiosco asistencia: emparejar, marcar, **no** desvincular desde el kiosco; token persiste tras recarga
- [ ] Responsive básico en móvil (menú, PQRS/usuarios en tarjetas)
- [ ] **SECOP:** activar `enable_contratacion`, configurar NIT SECOP I/II, dashboard `/contratacion`, alertas, export Excel, análisis IA (requiere `SECOP_OPENAI_API_KEY` en demo)
- [ ] **Planes Institucionales (D612):** activar `enable_planes_institucionales`, crear plan del catálogo por vigencia, asignar secretaría, actividades por trimestre, subir evidencia PDF/imagen (URL firmada), delegar contratista, cronograma `/planes/cronograma`, export informe trimestral Excel, prueba cross-entity (usuario entidad A no ve plan entidad B)
- [ ] **Informes Planes D612:** `/planes/informes` lista PDFs generados + **Crear informe** (PDF seguimiento o Excel trimestral), IA opcional, `409` si hay uno en curso, purga 7 días; workers Celery activos en demo
- [ ] **Informes PDM:** pestaña `/pdm/informes` (admin/secretario), generar PDF con vigencia y firmante, verificar `409` si hay uno en curso, descarga con membrete/gráficas, purga a los 7 días, workers Celery activos en demo

Si algo falla, corregir en `development` y volver a push (demo se redeploya solo).

---

## Checklist: subir a producción (`main`)

**Solo cuando demo esté estable y el negocio lo apruebe.**

### 1. Preparación (local)

```bash
git checkout development
git pull origin development

# Verificación local (opcional pero recomendado)
cd backend && python manage.py check
python manage.py migrate --plan   # ver plan sin aplicar
cd ../frontend && npm run build
```

### 2. Backup de base de datos prod

En el servidor prod (`/opt/softone-app`):

```bash
cd /opt/softone-app
export COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env"

# Ejemplo: dump antes del merge grande
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "/tmp/softone-prod-backup-$(date +%Y%m%d-%H%M).sql.gz"
```

Guardar el archivo fuera del servidor o en almacenamiento seguro.

### 3. Merge y push

```bash
git checkout main
git pull origin main
git merge development
# Resolver conflictos si los hay; NO editar el plan en .cursor/plans/

git push origin main
```

Eso dispara **deploy automático** a https://app.softone360.com (workflow `deploy-production.yml`).

### 4. Durante el deploy

El script `deploy/scripts/deploy.sh`:

- Reconstruye imágenes
- Levanta contenedores
- El **backend ejecuta `migrate --noinput` al arrancar** (incluye `0010_backfill_memberships` en prod)

### 5. Post-deploy prod (verificación)

```bash
cd /opt/softone-app
export COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env"

$COMPOSE exec backend python manage.py showmigrations accounts pqrs pdm | tail -20
$COMPOSE logs backend --tail 100

curl -fsS https://app.softone360.com/healthz
curl -fsS -o /dev/null -w "%{http_code}\n" https://app.softone360.com/login
```

Prueba manual rápida:

1. Admin con una entidad → login normal
2. Usuario multi-entidad → selector
3. Una PQRS de prueba → delegación a contratista
4. Kiosco ya desplegado antes → confirmar que sigue marcando

### 6. Sincronizar ramas

```bash
git checkout development
git merge main
git push origin development
```

Así demo y prod comparten la misma punta de historia.

---

## Clerk y entorno (prod vs demo)

| | Demo | Prod |
|---|------|------|
| Rama git | `development` | `main` |
| URL | demo.softone360.com | app.softone360.com |
| Clerk | Instancia **test** (`pk_test_` / `sk_test_`) | Instancia **live** |
| `.env` servidor | `/opt/softone-demo/.env` | `/opt/softone-app/.env` |

Al merge a prod **no cambies** las claves de Clerk de producción. Los usuarios de prod siguen en la instancia live; el backfill de membresías solo toca PostgreSQL local.

**SECOP en prod:** cuando se mergee, agregar `SECOP_OPENAI_API_KEY` en `/opt/softone-app/.env` (clave dedicada; rotar si estuvo expuesta).

**SECOP en demo:** agregar `SECOP_OPENAI_API_KEY` en `/opt/softone-demo/.env` y redeploy (`development`).

**Informes Planes D612 en demo:** agregar `PLANES_REPORTS_OPENAI_API_KEY` en `/opt/softone-demo/.env` (opcional; fallback a `PQRS_REPORTS_OPENAI_API_KEY` o `OPENAI_API_KEY`). Activar `enable_ai_reports` en la entidad para conclusiones con IA. Requiere `celery-worker` y `celery-beat` activos.

**Planes Institucionales en prod:** cuando se mergee el módulo D612:

1. Agregar `B2_BUCKET_PLANES=softone-planes-612` en `/opt/softone-app/.env`.
2. Agregar `PLANES_REPORTS_OPENAI_API_KEY` (opcional; fallback a `PQRS_REPORTS_OPENAI_API_KEY`).
3. Confirmar bucket `softone-planes-612` en B2 (privado, endpoint `s3.us-east-005.backblazeb2.com`).
4. Redeploy Cloudflare Worker: `bash deploy/scripts/deploy-cloudflare-worker-from-prod.sh` (incluye `softone-planes-612` en `ALLOWED_BUCKETS`).
5. Verificar regex nginx en `main`: `softone-(pqrs|pdm|th|correspondence|planes-612)` (si falta, evidencias 404).
6. Tras deploy: `$COMPOSE exec backend python manage.py showmigrations planes` → `[X] 0001_initial`, `[X] 0002_seed_catalogo_decreto612` y `[X] 0006_informe_plan`.
7. Activar `enable_planes_institucionales` por entidad en superadmin.

Rollback Planes: tablas nuevas y aisladas; revertir código no rompe otros módulos, pero las tablas `planes_*` permanecen en PostgreSQL hasta drop manual.

---

## Rollback (si algo sale mal en prod)

1. **Código:** revertir el merge en `main` y push (deploy anterior).  
   ⚠️ Las migraciones **no se revierten solas**. Si `0010` ya corrió, volver atrás en git no borra `UserEntityMembership`.

2. **Base de datos:** restaurar el dump de `pg_dump` (ventana de mantenimiento).

3. **Asistencia sola (estado actual de prod):** rollback de código es seguro porque no hubo migración de asistencia.

Para el paquete multi-entidad, **planificar ventana** y backup antes del merge.

---

## Comandos útiles (resumen)

| Acción | Demo | Prod |
|--------|------|------|
| Compose | `docker compose -f deploy/docker-compose.demo.yml --env-file .env` | `docker compose -f deploy/docker-compose.prod.yml --env-file .env` |
| Migrate manual | `… exec demo-backend python manage.py migrate` | `… exec backend python manage.py migrate` |
| Shell Django | `… exec demo-backend python manage.py shell` | `… exec backend python manage.py shell` |
| Logs backend | `… logs demo-backend -f` | `… logs backend -f` |
| Deploy manual | `deploy/scripts/deploy-demo.sh` | `deploy/scripts/deploy.sh` |

Ruta en servidor: demo → `/opt/softone-demo`, prod → `/opt/softone-app`.

---

## Preguntas frecuentes

**¿Tengo que migrar demo ahora mismo a mano?**  
Solo si tras el deploy el `showmigrations` muestra pendientes. En condiciones normales, no.

**¿Prod necesita migrate por el fix de asistencia?**  
No. Ese deploy ya está en `main` sin migraciones.

**¿Puedo mergear solo una parte a main?**  
El flujo acordado es merge completo `development` → `main` cuando toque. No hacer cherry-picks sueltos salvo hotfix urgente documentado.

**¿Cuándo actualizar este documento?**  
Cuando cambie el commit de referencia en `main`/`development` o el procedimiento de deploy.

---

## Jerarquía de delegación (referencia funcional)

| Rol | Usuarios | PQRS | PDM | Planes D612 |
|-----|----------|------|-----|-------------|
| **Admin** | Crea admin/secretario/contratista/ciudadano; contratista → elige **secretaría** | Asigna **secretaría** | Asigna **secretaría** | Crea plan por vigencia, asigna secretaría; genera informes (PDF/Excel) |
| **Secretario** | Ve y gestiona **contratistas de su secretaría** | Delega a contratistas bajo su secretaría | Asigna o quita contratista en productos de su secretaría | Actividades de su secretaría, evidencia, delega contratista; genera informes de su dependencia |
| **Contratista** | — | Responde PQRS delegadas | Ejecuta productos/actividades asignados | Actividades asignadas, avance y evidencia (sin acceso a informes) |

---

## Incidencia resuelta: login sin redirección (jul 2026)

**Síntoma:** Tras iniciar sesión en Clerk, la app se quedaba en login o en blanco hasta recargar manualmente.

**Causa:** Condición de carrera — Clerk marcaba sesión activa antes de que el JWT estuviera listo y antes de que `/auth/me` devolviera el perfil Django. En rutas públicas (`/login`, `/`) no se esperaba el perfil; `forceRedirectUrl="/"` mandaba a `/` sin usuario cargado; un 401 sin token cerraba sesión de golpe.

**Corrección (frontend):** `loadAuthProfile()` con espera de token y reintentos; pantalla de carga unificada; redirect solo cuando `user` existe; sin `forceRedirectUrl` en `<SignIn>`.

---

Ver también: [README.md](README.md) (arquitectura general), [docs/AUDITORIA.md](docs/AUDITORIA.md) (hallazgos técnicos).
