# Guía: despliegue a producción (`main`)

Documento de referencia para migrar cambios validados en **demo** (`development`) hacia **producción** (`main`).

> **Estado al 28 ago 2026**
>
> | Rama | URL | Notas |
> |------|-----|-------|
> | `development` | https://demo.softone360.com | Ejecución mensual PIIP + `fecha_ejecucion` + export PIIP por mes |
> | `main` | https://app.softone360.com | Sin estos cambios hasta merge |

---

## Cambio PDM: ejecución presupuestal mensual + export PIIP por mes

Nueva tabla independiente de la ejecución anual (`PDMEjecucionPresupuestal`). La carga general anual **no cambia** (dashboard, análisis, proyectos, armonizaciones).

### Migración

- **`pdm.0011_pdm_ejecucion_mensual_fecha_ejecucion`**
  - Tablas: `pdm_ejecucion_mensual`, `pdm_ejecucion_mensual_carga`
  - Campo `PdmActividad.fecha_ejecucion` (reemplaza `fecha_inicio` / `fecha_fin`)
  - Campo `InformePDM.mes` (corte mensual en informes PDF)

### Endpoints nuevos

| Método | Endpoint |
|---|---|
| `GET` | `/api/v1/pdm/ejecucion/mensual/?anio=` |
| `POST` | `/api/v1/pdm/ejecucion/mensual/upload` |
| `DELETE` | `/api/v1/pdm/ejecucion/mensual/<anio>/<mes>/` |

### Export PIIP

- `GET /api/v1/pdm/v2/{slug}/export-piip?anio=&mes=` (mes 1–12)
- Archivo: `PIIP_{slug}_{anio}_{MM}.xlsx`
- **VALOR INICIAL** = carga anual; comprometido/pago del mes y acumulados = carga mensual

### UI (solo admin)

- **Acciones → Ejecución mensual (PIIP)**: control de 12 meses, subir/borrar
- **Acciones → Exportar PIIP**: modal año + mes
- **Nueva evidencia de ejecución**: campo único **Fecha de ejecución**

### Informes

- PDF Avance: body `mes` (1–12)
- Plan de Acción Excel: query `mes` (1–12)
- Actividades filtradas por `fecha_ejecucion` ≤ fin de mes

---

## Verificar migración en demo

```bash
cd /opt/softone-demo
export COMPOSE="docker compose -f deploy/docker-compose.demo.yml --env-file .env"
$COMPOSE exec demo-backend python manage.py showmigrations pdm
# Debe incluir [X] 0011_pdm_ejecucion_mensual_fecha_ejecucion
```

Si queda pendiente:

```bash
$COMPOSE exec demo-backend python manage.py migrate pdm --noinput
```

---

## Checklist: validar en demo (antes de prod)

### Ejecución mensual

- [ ] **Acciones → Ejecución mensual (PIIP)** muestra los 12 meses del año seleccionado.
- [ ] Subir `Ejecucion Gastos_JULIO.xls` detecta julio 2026 y marca el mes como cargado.
- [ ] Reemplazar un mes sobrescribe la carga anterior.
- [ ] Eliminar mes deja el mes en pendiente.
- [ ] La carga anual general (Acciones → Ejecución presupuestal) sigue funcionando igual.

### Export PIIP

- [ ] **Exportar PIIP** pide año y mes antes de descargar.
- [ ] Columnas Comprometido/Pago del mes y acumulados reflejan la carga mensual.
- [ ] VALOR INICIAL sale de la carga anual; VALOR EJECUTADO = pago acumulado al mes.
- [ ] Mes sin carga mensual: comprometido/pago del mes en cero (aviso en modal).

### Fecha de ejecución

- [ ] Modal **Nueva evidencia de ejecución** muestra solo **Fecha de ejecución** (sin inicio/fin).
- [ ] Actividades existentes conservan fecha tras migración (backfill desde `fecha_fin` o `created_at`).
- [ ] Informe PDF y Plan de Acción con `mes=1` no incluyen actividades con `fecha_ejecucion` de febrero.

### Informes PDF / Excel

- [ ] Crear informe Avance PDF permite elegir mes.
- [ ] Plan de Acción Excel permite elegir mes y filtra actividades.

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

### 3. Merge y push

```bash
git checkout main
git pull origin main
git merge development
git push origin main
```

### 4. Post-deploy prod

```bash
$COMPOSE exec backend python manage.py showmigrations pdm | tail -5
$COMPOSE logs backend --tail 100
curl -fsS https://app.softone360.com/healthz
```

Prueba manual:

1. Login admin → PDM → Acciones → Ejecución mensual: subir al menos un mes.
2. Exportar PIIP del mismo mes y revisar columnas comprometido/pago.
3. Crear evidencia con **Fecha de ejecución** y verificar corte en informe.

### 5. Sincronizar ramas

```bash
git checkout development
git merge main
git push origin development
```

---

## Rollback

1. **Código:** revertir merge en `main` y push.
2. **Base de datos:** restaurar dump de `pg_dump`. La migración `0011` elimina `fecha_inicio`/`fecha_fin`; rollback de código sin restore dejará el frontend desincronizado.
3. Datos mensuales en `pdm_ejecucion_mensual` se pierden con restore a pre-migración.

---

## Comandos útiles

| Acción | Demo | Prod |
|--------|------|------|
| Compose | `docker compose -f deploy/docker-compose.demo.yml --env-file .env` | `docker compose -f deploy/docker-compose.prod.yml --env-file .env` |
| Migrate manual | `… exec demo-backend python manage.py migrate` | `… exec backend python manage.py migrate` |
| Deploy manual | `deploy/scripts/deploy-demo.sh` | `deploy/scripts/deploy.sh` |

Rutas en servidor: demo → `/opt/softone-demo`, prod → `/opt/softone-app`.

Ver también: [README.md](README.md) (arquitectura general).
