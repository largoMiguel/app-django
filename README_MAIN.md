# Guía: despliegue a producción (`main`)

Documento de referencia para migrar el módulo **Gestión documental** validado en **demo** (`development`) hacia **producción** (`main`).

> **Estado al 2 sep 2026**
>
> | Rama | URL | Notas |
> |------|-----|-------|
> | `development` | https://demo.softone360.com | En sync con `main` + WIP **Gestión documental** (solo demo) |
> | `main` | https://app.softone360.com | PDM ejecución mensual / PIIP + `fecha_ejecucion` + página de bienvenida |
>
> **Pendiente de prod:** módulo Gestión documental (no mergear a `main` hasta validar en demo).

---

## Cambio: Módulo Gestión documental (Ley 594 / Acuerdo AGN 001 de 2024)

Nueva app `apps.gestion_documental` con instrumentos archivísticos, TRD/CCD, expedientes, FUID, transferencias y disposición. Flag de entidad `enable_gestion_documental`.

### Migraciones

- **`entities.0007_initial_gestion_documental`** — campo `Entity.enable_gestion_documental`
- **`gestion_documental.0001_initial_gestion_documental`** — tablas SGDEA (`gd_instrumentos`, `gd_series_documentales`, `gd_expedientes`, `gd_documentos_expediente`, `gd_fuid_registros`, `gd_transferencias`, `gd_disposiciones`, `gd_eventos`, …)

### Endpoints nuevos

Base: `/api/v1/gestion-documental/`

| Método | Endpoint |
|---|---|
| `GET` | `/stats/` |
| CRUD | `/instrumentos/`, `/unidades/`, `/series/`, `/expedientes/`, `/fuid/`, `/transferencias/`, `/disposiciones/` |
| `POST` | `/instrumentos/{id}/archivo/`, `/series/importar/`, `/expedientes/{id}/documentos/`, `/fuid/generar-desde-expedientes/`, `/transferencias/{id}/ejecutar/` |
| `GET` | `/export/?tipo=fuid\|trd\|transferencias` |

### UI

Ruta `/gestion-documental` — pestañas: Resumen, Instrumentos, Clasificación, Expedientes, Inventario FUID, Transferencias, Informes.

### Bucket B2 (prod)

| Variable | Valor prod |
|---|---|
| `B2_BUCKET_GESTION_DOCUMENTAL` | `softone-document-management` |

Bucket ya creado en Backblaze B2 (privado, versionado, región `us-east-005`). Demo usa `storage-demo`.

---

## Verificar migración en demo

```bash
cd /opt/softone-demo
export COMPOSE="docker compose -f deploy/docker-compose.demo.yml --env-file .env"
$COMPOSE exec demo-backend python manage.py showmigrations entities gestion_documental
# Debe incluir [X] entities.0007_initial_gestion_documental
# Debe incluir [X] gestion_documental.0001_initial_gestion_documental
```

Si queda pendiente:

```bash
$COMPOSE exec demo-backend python manage.py migrate --noinput
```

---

## Checklist: validar en demo (antes de prod)

### Activación

- [ ] Superadmin → Entidad → activar **Gestión documental**.
- [ ] Admin/secretario ven el ítem **Gestión documental** en el menú lateral.

### Instrumentos

- [ ] **Instrumentos** → crear TRD vigencia 2026 → subir PDF/Excel.
- [ ] Cambiar estado (borrador → vigente).

### Clasificación TRD

- [ ] Importar Excel TRD o crear serie manualmente.
- [ ] Series muestran retención gestión/central y disposición (CT/S/E/MD).

### Expedientes

- [ ] Crear expediente asociado a una serie.
- [ ] Subir documento → aparece en hoja de control con SHA-256.
- [ ] Cerrar expediente.

### FUID e informes

- [ ] **Inventario FUID** → generar desde expedientes.
- [ ] **Informes** → descargar Excel FUID y TRD.

### Transferencias

- [ ] Crear transferencia primaria con expedientes → ejecutar → etapa pasa a central.

### Aislamiento

- [ ] Admin entidad A no ve expedientes/instrumentos de entidad B.

---

## Checklist: subir a producción

### 1. Preparación local

```bash
git checkout development
git pull origin development
cd backend && python manage.py check && python manage.py migrate --plan
cd ../frontend && npm run build
```

### 2. Backup PostgreSQL prod

```bash
cd /opt/softone-app
export COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env"
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "/tmp/softone-prod-backup-$(date +%Y%m%d-%H%M).sql.gz"
```

### 3. Variables prod (`.env` en `/opt/softone-app`)

```bash
B2_BUCKET_GESTION_DOCUMENTAL=softone-document-management
```

Verificar que `B2_KEY_ID` / `B2_APP_KEY` tengan acceso al bucket `softone-document-management`.

### 4. Cloudflare Worker (prod)

Tras merge, redeploy del worker para incluir el bucket:

```bash
bash deploy/scripts/deploy-cloudflare-worker-from-prod.sh
```

`wrangler.toml` debe listar `softone-document-management` en `ALLOWED_BUCKETS`.

Nginx prod/demo: regex debe incluir `document-management` en `deploy/nginx/conf.d/app.conf` y `conf.d-demo/app.conf`.

### 5. Merge y push

```bash
git checkout main
git pull origin main
git merge development
git push origin main
```

### 6. Post-deploy prod

```bash
$COMPOSE exec backend python manage.py showmigrations gestion_documental | tail -3
$COMPOSE logs backend --tail 100
curl -fsS https://app.softone360.com/healthz
```

Prueba manual:

1. Superadmin → activar **Gestión documental** en una entidad piloto.
2. Admin → cargar TRD + importar series → crear expediente → subir documento.
3. Generar FUID y descargar Excel.
4. Verificar descarga de archivo vía `https://files.softone360.com/softone-document-management/...`

### 7. Sincronizar ramas

```bash
git checkout development
git merge main
git push origin development
```

---

## Rollback

1. **Código:** revertir merge en `main` y push.
2. **Base de datos:** restaurar dump de `pg_dump`. Las tablas `gd_*` quedarán huérfanas si no se restaura.
3. **Archivos B2:** los objetos en `softone-document-management` permanecen; no se borran con rollback de código.

---

## Comandos útiles

| Acción | Demo | Prod |
|--------|------|------|
| Compose | `docker compose -f deploy/docker-compose.demo.yml --env-file .env` | `docker compose -f deploy/docker-compose.prod.yml --env-file .env` |
| Migrate manual | `… exec demo-backend python manage.py migrate` | `… exec backend python manage.py migrate` |
| Deploy manual | `deploy/scripts/deploy-demo.sh` | `deploy/scripts/deploy.sh` |

Rutas en servidor: demo → `/opt/softone-demo`, prod → `/opt/softone-app`.

Ver también: [README.md](README.md) (documentación del módulo).
