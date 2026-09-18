"""Serializers — PIC."""
from __future__ import annotations

from django.conf import settings
from rest_framework import serializers

from apps.common.file_delivery import signed_pic_url

from .calculos import actividad_metrics, calcular_valor_cobrado, disponible_ejecucion, total_ejecutado
from .models import PicActividad, PicCargo, PicEjecucion, PicEjecucionArchivo, PicPlan


class PicEjecucionArchivoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    nombre = serializers.CharField(source="nombre_original", read_only=True)

    class Meta:
        model = PicEjecucionArchivo
        fields = (
            "id",
            "nombre",
            "nombre_original",
            "content_type",
            "size",
            "url",
            "created_at",
        )

    def get_url(self, obj) -> str | None:
        if not obj.archivo:
            return None
        filename = obj.nombre_original or obj.archivo.name.split("/")[-1]
        if settings.USE_B2_STORAGE and settings.FILE_DELIVERY_SIGNING_KEY:
            return signed_pic_url(obj.archivo.name, filename=filename)
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.archivo.url)
        return obj.archivo.url


class PicEjecucionSerializer(serializers.ModelSerializer):
    archivos = PicEjecucionArchivoSerializer(many=True, read_only=True)
    trimestre_label = serializers.CharField(source="get_trimestre_display", read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PicEjecucion
        fields = (
            "id",
            "actividad",
            "fecha_ejecucion",
            "trimestre",
            "trimestre_label",
            "cantidad_ejecutada",
            "descripcion",
            "valor_cobrado",
            "registrado_por",
            "registrado_por_nombre",
            "archivos",
            "created_at",
        )

    def get_registrado_por_nombre(self, obj) -> str | None:
        if not obj.registrado_por_id:
            return None
        u = obj.registrado_por
        return u.get_full_name() or u.email


class PicActividadListSerializer(serializers.ModelSerializer):
    total_ejecutado = serializers.SerializerMethodField()
    disponible = serializers.SerializerMethodField()
    valor_cobrado_total = serializers.SerializerMethodField()
    avance_pct = serializers.SerializerMethodField()
    responsables_nombres = serializers.SerializerMethodField()
    responsable_secretaria_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PicActividad
        fields = (
            "id",
            "plan",
            "numero",
            "eje_estrategico",
            "linea_operativa",
            "encargado_texto",
            "actividad",
            "unidad_medida",
            "total_programado",
            "prog_t1",
            "prog_t2",
            "prog_t3",
            "prog_t4",
            "valor_total",
            "valor_unitario",
            "total_ejecutado",
            "disponible",
            "valor_cobrado_total",
            "avance_pct",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "responsables",
            "responsables_nombres",
            "fila_excel",
            "created_at",
            "updated_at",
        )

    def _metrics(self, obj):
        if not hasattr(obj, "_pic_metrics"):
            obj._pic_metrics = actividad_metrics(obj)
        return obj._pic_metrics

    def get_total_ejecutado(self, obj) -> int:
        return self._metrics(obj)["total_ejecutado"]

    def get_disponible(self, obj) -> int:
        return self._metrics(obj)["disponible"]

    def get_valor_cobrado_total(self, obj):
        return self._metrics(obj)["valor_cobrado_total"]

    def get_avance_pct(self, obj) -> float:
        return self._metrics(obj)["avance_pct"]

    def get_responsables_nombres(self, obj) -> list[str]:
        return [u.get_full_name() or u.email for u in obj.responsables.all()]

    def get_responsable_secretaria_nombre(self, obj) -> str | None:
        if obj.responsable_secretaria_id:
            return obj.responsable_secretaria.nombre
        return None


class PicActividadDetailSerializer(PicActividadListSerializer):
    soportes = serializers.CharField()
    resumen_trimestral = serializers.SerializerMethodField()
    ejecuciones = PicEjecucionSerializer(many=True, read_only=True)

    class Meta(PicActividadListSerializer.Meta):
        fields = PicActividadListSerializer.Meta.fields + (
            "soportes",
            "resumen_trimestral",
            "ejecuciones",
        )

    def get_resumen_trimestral(self, obj) -> list[dict]:
        return self._metrics(obj)["resumen_trimestral"]


class PicActividadResponsablesSerializer(serializers.Serializer):
    responsables = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)
    responsable_secretaria_id = serializers.IntegerField(required=False, allow_null=True)


class PicEjecucionWriteSerializer(serializers.Serializer):
    fecha_ejecucion = serializers.DateField()
    cantidad_ejecutada = serializers.IntegerField(min_value=1)
    descripcion = serializers.CharField(required=False, allow_blank=True, default="")


class PicEjecucionPreviewSerializer(serializers.Serializer):
    cantidad_ejecutada = serializers.IntegerField(min_value=1)


class PicPlanSerializer(serializers.ModelSerializer):
    actividades_count = serializers.SerializerMethodField()
    valor_total_pic = serializers.SerializerMethodField()

    class Meta:
        model = PicPlan
        fields = (
            "id",
            "entity",
            "anio",
            "archivo_nombre",
            "uploaded_by",
            "actividades_count",
            "valor_total_pic",
            "created_at",
            "updated_at",
        )

    def get_actividades_count(self, obj) -> int:
        return obj.actividades.count()

    def get_valor_total_pic(self, obj):
        from django.db.models import Sum

        return obj.actividades.aggregate(t=Sum("valor_total"))["t"] or 0


class PicCargoSerializer(serializers.ModelSerializer):
    usuarios_nombres = serializers.SerializerMethodField()

    class Meta:
        model = PicCargo
        fields = (
            "id",
            "entity",
            "etiqueta",
            "etiqueta_norm",
            "secretaria",
            "usuarios",
            "usuarios_nombres",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("etiqueta_norm",)

    def get_usuarios_nombres(self, obj) -> list[str]:
        return [u.get_full_name() or u.email for u in obj.usuarios.all()]


class PicCargoWriteSerializer(serializers.Serializer):
    etiqueta = serializers.CharField(max_length=256)
    secretaria_id = serializers.IntegerField(required=False, allow_null=True)
    usuarios = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)


class PicStatsSerializer(serializers.Serializer):
    anio = serializers.IntegerField()
    actividades_total = serializers.IntegerField()
    valor_total_pic = serializers.DecimalField(max_digits=16, decimal_places=2)
    valor_cobrado_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_programado = serializers.IntegerField()
    total_ejecutado = serializers.IntegerField()
    avance_pct = serializers.FloatField()
    por_trimestre = serializers.ListField()
    por_responsable = serializers.ListField()
    sin_responsables = serializers.IntegerField()


def preview_valor_cobrado(actividad: PicActividad, cantidad: int) -> dict:
    acum = total_ejecutado(actividad)
    disp = disponible_ejecucion(actividad)
    if cantidad > disp:
        return {
            "valido": False,
            "disponible": disp,
            "valor_cobrado": None,
            "mensaje": f"Solo quedan {disp} unidad(es) disponibles.",
        }
    valor = calcular_valor_cobrado(actividad, acum, cantidad)
    return {
        "valido": True,
        "disponible": disp,
        "valor_cobrado": valor,
        "mensaje": None,
    }
