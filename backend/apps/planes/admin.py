from django.contrib import admin

from .models import PlanActividad, PlanCatalogo, PlanEvidencia, PlanEvidenciaArchivo, PlanInstitucional


@admin.register(PlanCatalogo)
class PlanCatalogoAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "entity", "es_decreto612", "orden", "is_active")
    list_filter = ("es_decreto612", "is_active")
    search_fields = ("codigo", "nombre")


@admin.register(PlanInstitucional)
class PlanInstitucionalAdmin(admin.ModelAdmin):
    list_display = ("catalogo", "entity", "anio", "estado", "responsable_secretaria")
    list_filter = ("anio", "estado")
    search_fields = ("catalogo__nombre", "catalogo__codigo")


@admin.register(PlanActividad)
class PlanActividadAdmin(admin.ModelAdmin):
    list_display = ("nombre", "plan", "trimestre", "estado", "avance")
    list_filter = ("trimestre", "estado", "anio")


@admin.register(PlanEvidencia)
class PlanEvidenciaAdmin(admin.ModelAdmin):
    list_display = ("actividad", "entity", "fecha_registro")


@admin.register(PlanEvidenciaArchivo)
class PlanEvidenciaArchivoAdmin(admin.ModelAdmin):
    list_display = ("evidencia", "nombre_original", "size", "created_at")
