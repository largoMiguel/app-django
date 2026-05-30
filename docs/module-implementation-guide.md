# Guia de implementacion de nuevos modulos

## Objetivo
Definir como debe implementarse un nuevo modulo en una arquitectura multi-entidad, manteniendo aislamiento por entidad, permisos backend y consultas SQL optimizadas.

## Flujo recomendado
1. Definir entidad funcional del modulo (modelo principal y relaciones).
2. Agregar flag de habilitacion por entidad en `Entity`.
3. Exponer el modulo en `enabled_modules` de entidad y usuario.
4. Crear permisos Django (`view/add/change/delete`) y asignarlos a roles.
5. Implementar ViewSet con filtro base por entidad en backend.
6. Validar permisos por accion y por objeto en backend.
7. Exponer payload minimo para lista y payload completo solo en detalle.
8. Agregar pruebas cross-entity y pruebas de permisos.

## Estructura de backend
- Modelos: `backend/apps/<modulo>/models.py`
- Serializers list/detail: `backend/apps/<modulo>/serializers.py`
- Filtros: `backend/apps/<modulo>/filters.py`
- Vistas: `backend/apps/<modulo>/views.py`
- Pruebas: `backend/apps/<modulo>/tests/`

## Reglas de seguridad obligatorias
- Nunca confiar en filtros del frontend para seguridad.
- Toda consulta debe partir de un queryset filtrado por `entity_id`.
- Toda accion sensible debe validar permiso de accion y permiso por objeto.
- Nunca exponer datos de otra entidad aunque el usuario conozca el `id`.

## Reglas de consultas
- Lista: `select_related` solo para campos visibles en tabla.
- Detalle: `prefetch_related` solo cuando haga falta.
- Evitar N+1 en roles/grupos/FK frecuentes.
- Limitar `page_size` y definir `max_page_size` conservador.
- Agregar indices por `entity + campos de filtro`.

## Contrato frontend-backend
- Frontend usa guards para UX, no para seguridad.
- Frontend debe consumir endpoints paginados y filtros server-side.
- Reportes masivos deben resolverse en backend (preview/export), no descargando todo.

## Checklist de salida a produccion
- [ ] Permisos DRF por accion implementados.
- [ ] Filtro por entidad aplicado en todos los endpoints del modulo.
- [ ] Serializer de lista sin payload excesivo.
- [ ] Indices creados para consultas frecuentes.
- [ ] Pruebas cross-entity pasando.
- [ ] Pruebas de carga basicas en endpoints criticos.
