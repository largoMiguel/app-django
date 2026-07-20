from django.contrib import admin

from .models import Correspondencia, CorrespondenciaAnexo, CorrespondenciaEvento


@admin.register(Correspondencia)
class CorrespondenciaAdmin(admin.ModelAdmin):
    list_display = (
        "numero_radicado",
        "sentido",
        "estado",
        "asunto",
        "secretaria",
        "fecha_radicacion",
        "fecha_vencimiento",
        "entity",
    )
    list_filter = ("sentido", "estado", "canal", "entity")
    search_fields = ("numero_radicado", "asunto", "remitente_nombre", "destinatario_nombre")


@admin.register(CorrespondenciaAnexo)
class CorrespondenciaAnexoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "correspondencia", "size", "created_at")


@admin.register(CorrespondenciaEvento)
class CorrespondenciaEventoAdmin(admin.ModelAdmin):
    list_display = ("tipo", "correspondencia", "actor", "created_at")
