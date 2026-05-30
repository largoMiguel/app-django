# Plan de mejora aplicado sobre despliegue productivo

## Contexto actual
El proyecto despliega en Docker Compose productivo con Nginx, Cloudflare Tunnel, Django, React y PostgreSQL.

## Mejoras implementadas en esta iteracion
- Permisos por accion en endpoints PQRS usando backend (sin depender del frontend).
- Endpoint de reportes server-side (`/api/v1/pqrs/reports-preview/`) para evitar descarga masiva en cliente.
- Serializer de lista liviano para PQRS y serializer de reporte dedicado.
- Optimizacion de stats PQRS con agregaciones SQL.
- Reduccion de `max_page_size` para limitar sobrecarga.
- Scoping de Django Admin para usuarios por entidad.
- Validaciones de modulos habilitados por usuario y entidad.
- Restriccion de permisos asignables en roles custom para admins de entidad.
- Nuevo indice por entidad y fecha de solicitud en PQRS.

## Acciones operativas recomendadas antes de release
1. Ejecutar migraciones nuevas en entorno de staging.
2. Probar endpoints criticos:
   - `/api/v1/pqrs/`
   - `/api/v1/pqrs/stats/`
   - `/api/v1/pqrs/reports-preview/`
3. Validar que admins/secretarios/ciudadanos conserven flujo funcional.
4. Correr smoke test de frontend para listados de usuarios y entidades con paginacion.
5. Revisar logs de backend post-deploy durante 30-60 minutos.

## Despliegue
Seguir el flujo descrito en `README.md`:
- `deploy/scripts/sync.sh softone@192.168.1.2`
- `ssh softone@192.168.1.2 'cd /opt/softone-app && deploy/scripts/deploy.sh'`

## Rollback
Si aparece regresion funcional:
1. Revertir commit en rama de release.
2. Re-sincronizar servidor.
3. Re-ejecutar `deploy/scripts/deploy.sh`.
