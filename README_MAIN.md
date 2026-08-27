# Guía: despliegue a producción (`main`)

Documento de referencia para migrar cambios validados en **demo** (`development`) hacia **producción** (`main`).

> **Estado al 27 ago 2026**
>
> | Rama | URL | Notas |
> |------|-----|-------|
> | `development` | https://demo.softone360.com | En sync con `main` |
> | `main` | https://app.softone360.com | PDM multi-indicador + Plan de Acción Excel + armonización presupuesto ↔ PDM + gráficas Análisis + ejecución en Proyectos |

---

## Cambio PDM: gráficas en Análisis y etiqueta de presupuesto en Proyectos

Cambios **solo de frontend** (`frontend/src/features/pdm/PdmAnalisis.tsx`). No hay endpoints nuevos, migraciones ni variables de entorno.

- **Análisis → Por Línea Estratégica:** además de las barras de progreso, gráfico de barras horizontal con el avance por línea (etiqueta de % al final de cada barra y tooltip con nombre completo y número de productos).
- **Análisis → Análisis por Secretaría:** gráfico de barras horizontal agrupado con **avance físico** y **avance financiero** por secretaría, sobre la tabla existente. Solo visible para `admin` (igual que la tabla).
- Ambas gráficas respetan los filtros de **año** y **secretaría** de la pestaña Análisis y crecen en altura según el número de filas.

---

## Cambio PDM: ejecución presupuestal en Proyectos (BPIN)

Backend (`backend/apps/pdm/analytics.py`) + frontend (`PdmProyectosView.tsx`). Sin migraciones ni variables de entorno.

- Endpoint `GET /api/v1/pdm/v2/{slug}/proyectos`: cada proyecto expone `pto_definitivo` y `pagos` (ejecución presupuestal consolidada 2024-2027) en lugar de `presupuesto_total`.
- Los totales del proyecto suman códigos MGA **únicos** (indicadores hermanos no duplican ejecución).
- UI: bloque **Total Consolidado** con **Pto. Definitivo** y **Pagos** en la tarjeta; columnas **Pto. Def.** y **Pagos** en la tabla de productos.

---

## Cambio PDM: armonización presupuesto ↔ PDM

Permite asignar códigos de ejecución del Excel que no existen en el Plan Indicativo a un producto real del plan (suma ítem por ítem, sin borrar ejecución del destino).

- Migración: `pdm.0010_pdm_armonizacion` (`codigo_producto_origen` en ejecución + tabla `pdm_armonizacion_ejecucion`).
- Rol: solo **admin** de la entidad.
- Endpoints: `GET/POST /api/v1/pdm/ejecucion/armonizaciones/`, `DELETE .../{id}/`, `GET .../candidatos/?search=`.
- UI: PDM → Resumen → advertencia **Ejecución sin producto en el Plan Indicativo** → **Armonizar**.
- Acceso permanente (aunque no haya advertencia): **PDM → Acciones → Armonizaciones presupuesto** (solo admin), para consultar y **revertir** las vigentes.
- Tras armonizar, la advertencia desaparece y el producto destino muestra badge *Incluye ejecución armonizada de: …* (en la pestaña de ejecución presupuestal del detalle, bajo la tabla), con enlace a Acciones → Armonizaciones presupuesto para revertir.
- Las recargas del Excel respetan las armonizaciones guardadas.

---

## Cambio PDM: Plan de Acción (Excel)

Nuevo informe en **PDM → Informes → Crear informe → Plan de Acción (Excel)**:

- Descarga **inmediata** (sin Celery, sin B2, sin historial).
- Filtros: **vigencia** (2024–2027) y **dependencia** (admin; secretario forzado a su secretaría).
- Endpoint: `GET /api/v1/pdm/v2/{slug}/export-plan-accion?anio=&responsable_secretaria=`
- Archivo: `Plan_Accion_PDM_{slug}_{anio}.xlsx` con tres hojas:
  1. **Plan de acción** — una fila por actividad (meta, responsables, estado, evidencias).
  2. **Resumen por producto** — metas programadas/asignadas/ejecutadas, avance físico y financiero.
  3. **Resumen por dependencia** — consolidado por secretaría.

**No requiere migraciones** ni variables de entorno adicionales.

---

## Cambio PDM: productos con varios indicadores

A partir de la migración `pdm.0009_pdm_clave_producto`:

- Cada fila del Excel **Plan indicativo - Productos** se guarda como un registro distinto.
- **`clave_producto`**: identificador único por entidad (URL `/pdm/productos/{clave}`).
  - Productos sin repetir → `clave = codigo_producto` (sin cambio).
  - Productos repetidos → `4003018-400301802`, `4003018-400301807`, etc.
- **`codigo_producto`**: sigue siendo el código MGA de 7 dígitos; une ejecución presupuestal y contratos RPS.
- **Actividades** usan `clave_producto`.
- Tras desplegar, **volver a cargar el Excel del Plan Indicativo** para que aparezcan los indicadores duplicados (p. ej. 108 filas en lugar de 105).

---

## ¿Cuándo se aplican las migraciones?

No hace falta correr `migrate` a mano en el flujo normal. El contenedor `backend` ejecuta `migrate --noinput` al arrancar (`backend/docker-entrypoint.sh`).

| Evento | Efecto |
|--------|--------|
| Push a `development` | Deploy demo → migrate automático |
| Push a `main` | Deploy prod → migrate automático |

### Verificar migración PDM en demo

```bash
cd /opt/softone-demo
export COMPOSE="docker compose -f deploy/docker-compose.demo.yml --env-file .env"
$COMPOSE exec demo-backend python manage.py showmigrations pdm
# Debe incluir [X] 0009_pdm_clave_producto y [X] 0010_pdm_armonizacion
```

Si queda pendiente:

```bash
$COMPOSE exec demo-backend python manage.py migrate pdm --noinput
```

---

## Checklist: validar en demo (antes de prod)

### Plan de Acción Excel

- [ ] **Crear informe** muestra dos opciones habilitadas: Avance PDF y Plan de Acción Excel.
- [ ] **Crear informe → Plan de Acción (Excel)** abre modal con vigencia y dependencia (admin).
- [ ] Descarga genera `.xlsx` con hojas *Plan de acción*, *Resumen por producto* y *Resumen por dependencia*.
- [ ] Columnas incluyen metas, responsables, por ejecutar, avance y ejecución presupuestal.
- [ ] Secretario solo exporta su dependencia (sin selector de secretaría).
- [ ] No aparece en historial de informes PDF (descarga inmediata).

### Productos multi-indicador
- [ ] Producto `4003018` aparece **dos veces** en la lista, distinguible por indicador.
- [ ] Buscar `400301802` o `IP-35` encuentra el indicador correcto.
- [ ] Detalle muestra selector de indicadores hermanos y nota de ejecución compartida.
- [ ] Actividades y evidencias previas del producto `4003018` siguen visibles tras recargar Excel.
- [ ] Productos no duplicados conservan URL `/pdm/productos/1702038`.
- [ ] Dashboard/estadísticas no duplican ejecución presupuestal entre indicadores hermanos.

### Armonización presupuesto ↔ PDM
- [ ] Admin ve advertencia **Ejecución sin producto en el Plan Indicativo** con botón **Armonizar** por fila.
- [ ] Modal permite buscar producto del plan y confirmar armonización (origen → destino).
- [ ] Tras armonizar, el código desaparece de la advertencia y la ejecución se suma al producto destino.
- [ ] Detalle del producto destino muestra *Incluye ejecución armonizada de: …*.
- [ ] Recargar Excel de ejecución del año mantiene la armonización.
- [ ] **Revertir** en el modal restaura el código huérfano en la advertencia.
- [ ] Secretario **no** ve botón Armonizar ni puede llamar los endpoints.
- [ ] **Acciones → Armonizaciones presupuesto** abre el modal con las armonizaciones vigentes y permite revertir.

### Gráficas en Análisis PDM
- [ ] **Análisis → Por Línea Estratégica** muestra el gráfico de barras horizontal con el % de avance por línea.
- [ ] **Análisis → Análisis por Secretaría** (admin) muestra el gráfico de barras con avance físico y financiero sobre la tabla.
- [ ] Cambiar el filtro de **año** o de **secretaría** actualiza ambas gráficas.
- [ ] Con muchas líneas/secretarías el gráfico crece en alto y las etiquetas no se solapan.
- [ ] Entidad sin datos por línea: no se renderiza el gráfico y se mantiene el mensaje *Sin datos por línea estratégica*.

### Proyectos (BPIN) — ejecución presupuestal
- [ ] Cada tarjeta de proyecto muestra **Total Consolidado** con **Pto. Definitivo** y **Pagos**.
- [ ] Al expandir el proyecto, las columnas **Pto. Def.** y **Pagos** aparecen por producto (ocultas en móvil).
- [ ] El total consolidado de la tarjeta coincide con la suma de códigos MGA únicos (sin duplicar indicadores hermanos).
- [ ] Proyecto sin ejecución cargada muestra $0 en ambos campos.

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

Dispara deploy automático a https://app.softone360.com.

### 4. Post-deploy prod

```bash
$COMPOSE exec backend python manage.py showmigrations pdm | tail -5
$COMPOSE logs backend --tail 100
curl -fsS https://app.softone360.com/healthz
```

Prueba manual:

1. Login admin → módulo PDM.
2. Recargar Excel del Plan Indicativo de la entidad.
3. Confirmar productos duplicados visibles y detalle por indicador.

### 5. Sincronizar ramas

```bash
git checkout development
git merge main
git push origin development
```

---

## Rollback

1. **Código:** revertir merge en `main` y push.
2. **Base de datos:** restaurar dump de `pg_dump`. Las migraciones `0009`/`0010` no se revierten solas; los datos con `clave_producto` compuesto o armonizaciones permanecen hasta restore.
3. Si solo se despliega código anterior sin restore, productos con claves compuestas pueden quedar huérfanos hasta nueva carga del Excel. Revertir `0010` puede fallar si hay filas armonizadas con mismo producto/fuente/año → usar restore de dump.

---

## Comandos útiles

| Acción | Demo | Prod |
|--------|------|------|
| Compose | `docker compose -f deploy/docker-compose.demo.yml --env-file .env` | `docker compose -f deploy/docker-compose.prod.yml --env-file .env` |
| Migrate manual | `… exec demo-backend python manage.py migrate` | `… exec backend python manage.py migrate` |
| Deploy manual | `deploy/scripts/deploy-demo.sh` | `deploy/scripts/deploy.sh` |

Rutas en servidor: demo → `/opt/softone-demo`, prod → `/opt/softone-app`.

Ver también: [README.md](README.md) (arquitectura general).
