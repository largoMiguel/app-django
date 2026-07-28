# Auditoría SoftOne App — Julio 2026

## Resumen ejecutivo

Revisión de seguridad, rendimiento y UX del stack Django 5 + React 19. Se corrigieron en este ciclo los hallazgos **críticos** de asistencia (rotación de token por marcación) y se implementaron membresías multi-entidad, jerarquía de delegación y mejoras de UI. El resto queda documentado para priorización.

---

## Crítico (corregido en este ciclo)

| # | Hallazgo | Impacto | Acción |
|---|----------|---------|--------|
| C1 | Token de kiosk rotaba en **cada marcación** (`asistencia/services.py`) | Desvinculación espontánea si el navegador no persistía el token nuevo | Eliminada rotación; token estable hasta revocación explícita |
| C2 | Botón "Desvincular" en kiosk accesible a cualquiera | Funcionario desvinculaba el equipo sin autorización | Eliminado del kiosk; solo "Revocar" en panel admin |
| C3 | `session()` del kiosk borraba token ante **cualquier** error de red | Falsos positivos de desvinculación | Solo limpia token en 401/403; reintento con backoff en red |
| C4 | Token solo en `localStorage` | Pérdida al limpiar caché del navegador | Redundancia: localStorage + cookie + IndexedDB |
| C5 | `User.entity` FK único impedía admin multi-entidad | Conflicto al crear admin existente en otra entidad | Modelo `UserEntityMembership` + cabecera `X-Entity-Id` |
| C6 | Creación de usuario fallaba si email existía en Clerk | Error opaco al agregar admin a segunda entidad | Reutilizar usuario Django + añadir membresía |

---

## Alto (pendiente / parcial)

| # | Hallazgo | Recomendación |
|---|----------|---------------|
| A1 | Sin suite de tests automatizados (eliminados en `d2ec4d3`) | Restaurar tests de integración para auth, PQRS asignación y kiosk |
| A2 | Sidebar fijo `w-16` sin menú móvil | **Corregido parcialmente**: drawer en `< md` |
| A3 | Login dos columnas no alineado con referencia | **Corregido**: card centrado estilo Laravel CRM |
| A4 | Secretario no podía delegar PQRS/PDM a contratista | **Corregido**: sub-asignación a usuario + rol contratista |
| A5 | `enabled_modules` vacío para secretario = ningún módulo (correcto pero poco documentado) | Documentar en UI de Usuarios con tooltip |
| A6 | Clerk provisioning antes de validar email en Django | **Corregido**: lookup previo + membresía |

---

## Medio — Rendimiento (N+1 e índices)

| Área | Observación | Estado |
|------|-------------|--------|
| PQRS list | `select_related` en entity/created_by; M2M `assigned_secretarias` puede N+1 en detalle | Prefetch en ViewSet detalle recomendado |
| PDM productos | Filtro por secretaría indexado vía FK | OK |
| Asistencia registros | Índice en `device_token_hash`, `entity+fecha_hora` | OK |
| Users list | `select_related('entity','secretaria')` en ViewSet | OK |
| Auth `/me` | Prefetch groups en ClerkAuthentication | OK |

**Índices sugeridos (futuro):**
- `pqrs_pqrs_assigned_users` M2M — índice en through table si crece >100k filas
- `accounts_userentitymembership (user_id, is_active)` — cubierto por unique_together

---

## Medio — Aislamiento multi-tenant

| Módulo | Patrón | Riesgo |
|--------|--------|--------|
| PQRS | `pqrs_queryset_for_user` | Bajo — superadmin excluido de operación |
| PDM | `_ensure_user_can_manage_entity` | Bajo |
| Asistencia | `ensure_asistencia_access` | Bajo |
| Correspondencia | `correspondencia_queryset` | Bajo |
| Users | `filter(entity_id=actor.entity_id)` | Bajo — **mejorado** con membresías |
| Media protegida | Token Clerk + entity en path | Medio — auditar paths B2 |

No se encontraron consultas operativas sin filtro de entidad en módulos de negocio.

---

## Medio — Endpoints públicos

| Endpoint | Rate limit | Validación |
|----------|------------|------------|
| `/public/entity/{slug}/pqrs/` | 30/h IP | OK |
| `/public/asistencia/kiosk/pair` | Throttle dedicado | OK |
| `/public/asistencia/kiosk/registros` | Throttle dedicado | OK |
| Portal PQRS auto-create | 20/h usuario | OK |

---

## Bajo — Frontend

| Tema | Nota |
|------|------|
| Bundle | Rutas lazy en PDM/showcase; face-api solo en kiosk |
| Accesibilidad | Mejorar `aria-label` en sidebar móvil y modales |
| Dark mode | Solo login (toggle local); app principal sin tema oscuro |
| Tablas móviles | **Mejorado parcialmente** en shell; páginas densas (PQRS informes) pendientes |

---

## Bajo — Operaciones

| Tema | Nota |
|------|------|
| Deploy | `main` → prod, `development` → demo; cloudflared compartido |
| Backups | Cron 14 días en `/var/backups/softone/` |
| Redis | Rate-limit DRF en prod |

---

## Checklist post-implementación

- [ ] `python manage.py check --deploy`
- [ ] `python manage.py makemigrations --check --dry-run`
- [ ] `npm run build` + `tsc -b`
- [ ] Probar kiosk: emparejar → marcar → recargar → marcar (token estable)
- [ ] Probar admin en 2 entidades: selector + cabecera
- [ ] Probar secretario crea contratista y asigna PQRS
