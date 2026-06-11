"""Serializers para módulo PDM."""
from __future__ import annotations

from rest_framework import serializers

from apps.common.file_delivery import signed_pdm_url
from .models import (
    PdmActividad,
    PdmActividadEvidencia,
    PdmEvidenciaArchivo,
    PdmIniciativaSGR,
    PdmProducto,
)


class PdmEvidenciaArchivoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = PdmEvidenciaArchivo
        fields = ("id", "nombre", "nombre_original", "content_type", "size", "url", "created_at")
        read_only_fields = fields

    def get_url(self, obj):
        if not obj.archivo:
            return None
        from django.conf import settings

        if settings.USE_B2_STORAGE and settings.FILE_DELIVERY_SIGNING_KEY:
            filename = obj.nombre_original or obj.archivo.name.rsplit("/", 1)[-1]
            return signed_pdm_url(obj.archivo.name, filename=filename)

        request = self.context.get("request")
        url = obj.archivo.url
        if request and not url.startswith("http"):
            return request.build_absolute_uri(url)
        return url

    def get_nombre(self, obj):
        return obj.nombre_original or (obj.archivo.name.rsplit("/", 1)[-1] if obj.archivo else "")


class PdmActividadEvidenciaSerializer(serializers.ModelSerializer):
    archivos = PdmEvidenciaArchivoSerializer(many=True, read_only=True)

    class Meta:
        model = PdmActividadEvidencia
        fields = (
            "id",
            "actividad",
            "entity",
            "descripcion",
            "url_evidencia",
            "archivos",
            "fecha_registro",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "actividad", "entity", "fecha_registro", "created_at", "updated_at", "archivos")


class PdmIniciativaSGRSerializer(serializers.ModelSerializer):
    class Meta:
        model = PdmIniciativaSGR
        exclude = ("entity",)


class PdmActividadSerializer(serializers.ModelSerializer):
    responsable_secretaria_nombre = serializers.CharField(
        source="responsable_secretaria.nombre",
        read_only=True,
    )
    tiene_evidencia = serializers.SerializerMethodField()

    class Meta:
        model = PdmActividad
        fields = (
            "id",
            "entity",
            "codigo_producto",
            "anio",
            "nombre",
            "descripcion",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "fecha_inicio",
            "fecha_fin",
            "meta_ejecutar",
            "estado",
            "tiene_evidencia",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "entity", "created_at", "updated_at")

    def get_tiene_evidencia(self, obj):
        return hasattr(obj, "evidencia") and obj.evidencia is not None


class PdmProductoListSerializer(serializers.ModelSerializer):
    """Payload mínimo para tabla paginada."""

    avance_anio = serializers.FloatField(read_only=True, required=False)
    estado_anio = serializers.CharField(read_only=True, required=False)
    meta_anio = serializers.FloatField(read_only=True, required=False)
    presupuesto_anio = serializers.FloatField(read_only=True, required=False)
    pto_definitivo_anio = serializers.FloatField(read_only=True, required=False)
    pagos_anio = serializers.FloatField(read_only=True, required=False)
    avance_financiero_anio = serializers.FloatField(read_only=True, required=False)
    porcentaje_ejecucion = serializers.FloatField(read_only=True, required=False)

    class Meta:
        model = PdmProducto
        fields = (
            "id",
            "codigo_producto",
            "producto_mga",
            "indicador_producto_mga",
            "personalizacion_indicador",
            "linea_estrategica",
            "sector_mga",
            "programa_mga",
            "ods",
            "tipo_acumulacion",
            "bpin",
            "unidad_medida",
            "meta_cuatrienio",
            "programacion_2024",
            "programacion_2025",
            "programacion_2026",
            "programacion_2027",
            "total_2024",
            "total_2025",
            "total_2026",
            "total_2027",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "avance_anio",
            "estado_anio",
            "meta_anio",
            "presupuesto_anio",
            "pto_definitivo_anio",
            "pagos_anio",
            "avance_financiero_anio",
            "porcentaje_ejecucion",
        )


class PdmProductoSerializer(serializers.ModelSerializer):
    actividades = PdmActividadSerializer(many=True, read_only=True, source="pdm_actividades_filtradas")
    avance_anio = serializers.FloatField(read_only=True, required=False)
    estado_anio = serializers.CharField(read_only=True, required=False)
    meta_anio = serializers.FloatField(read_only=True, required=False)
    presupuesto_anio = serializers.FloatField(read_only=True, required=False)
    pto_definitivo_anio = serializers.FloatField(read_only=True, required=False)
    pagos_anio = serializers.FloatField(read_only=True, required=False)
    avance_financiero_anio = serializers.FloatField(read_only=True, required=False)
    porcentaje_ejecucion = serializers.FloatField(read_only=True, required=False)
    resumen_por_anio = serializers.JSONField(read_only=True, required=False)

    class Meta:
        model = PdmProducto
        fields = (
            "id",
            "entity",
            "codigo_dane",
            "entidad_territorial",
            "nombre_plan",
            "codigo_indicador_producto",
            "codigo_producto",
            "linea_estrategica",
            "codigo_sector",
            "sector_mga",
            "codigo_programa",
            "programa_mga",
            "codigo_producto_mga",
            "producto_mga",
            "codigo_indicador_producto_mga",
            "indicador_producto_mga",
            "personalizacion_indicador",
            "unidad_medida",
            "meta_cuatrienio",
            "principal",
            "codigo_ods",
            "ods",
            "tipo_acumulacion",
            "bpin",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "programacion_2024",
            "programacion_2025",
            "programacion_2026",
            "programacion_2027",
            "presupuesto_2024",
            "presupuesto_2025",
            "presupuesto_2026",
            "presupuesto_2027",
            "total_2024",
            "total_2025",
            "total_2026",
            "total_2027",
            "actividades",
            "avance_anio",
            "estado_anio",
            "meta_anio",
            "presupuesto_anio",
            "pto_definitivo_anio",
            "pagos_anio",
            "avance_financiero_anio",
            "porcentaje_ejecucion",
            "resumen_por_anio",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "entity", "created_at", "updated_at")


class PdmProductoUploadSerializer(serializers.Serializer):
    codigo_dane = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    entidad_territorial = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    nombre_plan = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    codigo_indicador_producto = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    codigo_producto = serializers.CharField()
    linea_estrategica = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    codigo_sector = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sector_mga = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    codigo_programa = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    programa_mga = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    codigo_producto_mga = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    producto_mga = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    codigo_indicador_producto_mga = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    indicador_producto_mga = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    personalizacion_indicador = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    unidad_medida = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    meta_cuatrienio = serializers.FloatField(required=False, allow_null=True)
    principal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    codigo_ods = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    ods = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    tipo_acumulacion = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    bpin = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    programacion_2024 = serializers.FloatField(required=False, default=0)
    programacion_2025 = serializers.FloatField(required=False, default=0)
    programacion_2026 = serializers.FloatField(required=False, default=0)
    programacion_2027 = serializers.FloatField(required=False, default=0)
    presupuesto_2024 = serializers.JSONField(required=False, allow_null=True)
    presupuesto_2025 = serializers.JSONField(required=False, allow_null=True)
    presupuesto_2026 = serializers.JSONField(required=False, allow_null=True)
    presupuesto_2027 = serializers.JSONField(required=False, allow_null=True)
    total_2024 = serializers.FloatField(required=False, default=0)
    total_2025 = serializers.FloatField(required=False, default=0)
    total_2026 = serializers.FloatField(required=False, default=0)
    total_2027 = serializers.FloatField(required=False, default=0)


class PdmDataUploadSerializer(serializers.Serializer):
    productos_plan_indicativo = PdmProductoUploadSerializer(many=True)
    iniciativas_sgr = PdmIniciativaSGRSerializer(many=True, required=False)

