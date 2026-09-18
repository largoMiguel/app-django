from django.contrib import admin

from .models import PicActividad, PicCargo, PicEjecucion, PicEjecucionArchivo, PicPlan


@admin.register(PicPlan)
class PicPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "entity", "anio", "archivo_nombre", "updated_at")
    list_filter = ("anio", "entity")


@admin.register(PicCargo)
class PicCargoAdmin(admin.ModelAdmin):
    list_display = ("id", "entity", "etiqueta", "etiqueta_norm", "secretaria")
    list_filter = ("entity",)
    filter_horizontal = ("usuarios",)


@admin.register(PicActividad)
class PicActividadAdmin(admin.ModelAdmin):
    list_display = ("numero", "plan", "encargado_texto", "total_programado", "valor_total")
    list_filter = ("plan__anio", "entity")
    search_fields = ("actividad", "encargado_texto")
    filter_horizontal = ("responsables",)


@admin.register(PicEjecucion)
class PicEjecucionAdmin(admin.ModelAdmin):
    list_display = ("id", "actividad", "fecha_ejecucion", "trimestre", "cantidad_ejecutada", "valor_cobrado")
    list_filter = ("trimestre", "entity")


@admin.register(PicEjecucionArchivo)
class PicEjecucionArchivoAdmin(admin.ModelAdmin):
    list_display = ("id", "ejecucion", "nombre_original", "size", "created_at")
