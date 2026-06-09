from django.contrib import admin

from apps.common.roles import is_platform_superadmin

from .models import PQRS, AsignacionAuditoria, CorreoEntrantePQRS, PQRSArchivo


class EntityScopedAdminMixin:
    """Limita queryset de admin por entidad (excepto superadmin de plataforma)."""

    entity_field = "entity_id"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if is_platform_superadmin(request.user):
            return qs
        if request.user.entity_id:
            return qs.filter(**{self.entity_field: request.user.entity_id})
        return qs.none()


@admin.register(PQRS)
class PQRSAdmin(EntityScopedAdminMixin, admin.ModelAdmin):
    list_display = (
        "numero_radicado", "entity", "tipo_solicitud", "estado", "assigned_to", "fecha_solicitud"
    )
    list_filter = ("entity", "tipo_solicitud", "estado", "canal_llegada")
    search_fields = ("numero_radicado", "asunto", "nombre_ciudadano", "cedula_ciudadano")
    readonly_fields = ("numero_radicado", "created_at", "updated_at")


@admin.register(AsignacionAuditoria)
class AsignacionAuditoriaAdmin(EntityScopedAdminMixin, admin.ModelAdmin):
    entity_field = "pqrs__entity_id"

    list_display = ("pqrs", "accion", "secretaria_anterior", "secretaria_nueva", "fecha_asignacion")
    list_filter = ("accion",)
    search_fields = ("pqrs__numero_radicado", "justificacion")


@admin.register(PQRSArchivo)
class PQRSArchivoAdmin(EntityScopedAdminMixin, admin.ModelAdmin):
    entity_field = "pqrs__entity_id"

    list_display = ("id", "pqrs", "nombre_original", "size", "created_at")
    search_fields = ("pqrs__numero_radicado", "nombre_original")


@admin.register(CorreoEntrantePQRS)
class CorreoEntrantePQRSAdmin(EntityScopedAdminMixin, admin.ModelAdmin):
    entity_field = "entity_id"

    list_display = ("remitente", "estado", "entity", "pqrs", "recibido_at", "created_at")
    list_filter = ("estado", "entity")
    search_fields = ("remitente", "asunto", "message_id", "pqrs__numero_radicado")
    readonly_fields = ("message_id", "created_at")
