"""Serializers — Planes Institucionales."""
from __future__ import annotations

from rest_framework import serializers

from apps.common.file_delivery import signed_planes_url
from apps.entities.models import Secretaria

from .models import (
    ActividadEstado,
    PlanActividad,
    PlanCatalogo,
    PlanEvidencia,
    PlanEvidenciaArchivo,
    PlanEstado,
    PlanInstitucional,
    Trimestre,
)


class PlanEvidenciaArchivoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = PlanEvidenciaArchivo
        fields = ("id", "nombre", "nombre_original", "content_type", "size", "url", "created_at")
        read_only_fields = fields

    def get_url(self, obj):
        if not obj.archivo:
            return None
        from django.conf import settings

        try:
            if settings.USE_B2_STORAGE and settings.FILE_DELIVERY_SIGNING_KEY:
                filename = obj.nombre_original or obj.archivo.name.rsplit("/", 1)[-1]
                return signed_planes_url(obj.archivo.name, filename=filename)

            request = self.context.get("request")
            url = obj.archivo.url
            if request and not url.startswith("http"):
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None

    def get_nombre(self, obj):
        return obj.nombre_original or (obj.archivo.name.rsplit("/", 1)[-1] if obj.archivo else "")


class PlanEvidenciaSerializer(serializers.ModelSerializer):
    archivos = PlanEvidenciaArchivoSerializer(many=True, read_only=True)

    class Meta:
        model = PlanEvidencia
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


class PlanActividadSerializer(serializers.ModelSerializer):
    responsable_secretaria_nombre = serializers.CharField(
        source="responsable_secretaria.nombre",
        read_only=True,
    )
    responsable_usuario_nombre = serializers.SerializerMethodField()
    tiene_evidencia = serializers.SerializerMethodField()
    trimestre_label = serializers.SerializerMethodField()
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = PlanActividad
        fields = (
            "id",
            "entity",
            "plan",
            "anio",
            "trimestre",
            "trimestre_label",
            "nombre",
            "descripcion",
            "meta",
            "indicador",
            "fecha_inicio",
            "fecha_fin",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "responsable_usuario",
            "responsable_usuario_nombre",
            "estado",
            "estado_label",
            "avance",
            "tiene_evidencia",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "entity", "created_at", "updated_at")

    def get_responsable_usuario_nombre(self, obj) -> str | None:
        if not obj.responsable_usuario_id:
            return None
        user = obj.responsable_usuario
        return user.full_name or user.email

    def get_tiene_evidencia(self, obj) -> bool:
        try:
            return obj.evidencia is not None
        except PlanEvidencia.DoesNotExist:
            return False

    def get_trimestre_label(self, obj) -> str:
        try:
            return Trimestre(obj.trimestre).label
        except ValueError:
            return str(obj.trimestre)


class PlanActividadDetailSerializer(PlanActividadSerializer):
    evidencia = serializers.SerializerMethodField()

    class Meta(PlanActividadSerializer.Meta):
        fields = PlanActividadSerializer.Meta.fields + ("evidencia",)

    def get_evidencia(self, obj):
        try:
            ev = obj.evidencia
        except PlanEvidencia.DoesNotExist:
            return None
        if ev is None:
            return None
        return PlanEvidenciaSerializer(ev, context=self.context).data


class PlanListSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="catalogo.nombre", read_only=True)
    catalogo_codigo = serializers.CharField(source="catalogo.codigo", read_only=True)
    catalogo_nombre = serializers.CharField(source="catalogo.nombre", read_only=True)
    responsable_secretaria_nombre = serializers.CharField(
        source="responsable_secretaria.nombre",
        read_only=True,
    )
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    actividades_count = serializers.IntegerField(read_only=True, required=False)
    avance_promedio = serializers.FloatField(read_only=True, required=False)

    class Meta:
        model = PlanInstitucional
        fields = (
            "id",
            "entity",
            "catalogo",
            "catalogo_codigo",
            "catalogo_nombre",
            "anio",
            "nombre",
            "objetivo",
            "responsable_secretaria",
            "responsable_secretaria_nombre",
            "responsable_usuario",
            "fecha_publicacion",
            "url_publicacion",
            "estado",
            "estado_label",
            "actividades_count",
            "avance_promedio",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "entity", "created_at", "updated_at")


class PlanDetailSerializer(PlanListSerializer):
    actividades = serializers.SerializerMethodField()
    resumen_por_trimestre = serializers.SerializerMethodField()

    class Meta(PlanListSerializer.Meta):
        fields = PlanListSerializer.Meta.fields + ("actividades", "resumen_por_trimestre")

    def get_actividades(self, obj):
        actividades = self.context.get("actividades_detail")
        if actividades is None:
            actividades = getattr(obj, "actividades", [])
            if hasattr(actividades, "all"):
                actividades = actividades.all()
        return PlanActividadDetailSerializer(
            actividades,
            many=True,
            context=self.context,
        ).data

    def get_resumen_por_trimestre(self, obj):
        cached = self.context.get("resumen_por_trimestre")
        if cached is not None:
            return cached
        return getattr(obj, "resumen_por_trimestre", [])


class PlanWriteSerializer(serializers.Serializer):
    catalogo_id = serializers.IntegerField()
    anio = serializers.IntegerField(min_value=2000, max_value=2100)
    objetivo = serializers.CharField(required=False, allow_blank=True, default="")
    responsable_secretaria_id = serializers.IntegerField(required=False, allow_null=True)
    fecha_publicacion = serializers.DateField(required=False, allow_null=True)
    url_publicacion = serializers.CharField(required=False, allow_blank=True, default="")
    estado = serializers.ChoiceField(choices=PlanEstado.choices, required=False)

    def validate_catalogo_id(self, value):
        entity = self.context["entity"]
        catalogo = PlanCatalogo.objects.filter(pk=value, is_active=True).first()
        if catalogo is None:
            raise serializers.ValidationError("Catálogo inválido.")
        if catalogo.entity_id is not None and catalogo.entity_id != entity.id:
            raise serializers.ValidationError("El catálogo no pertenece a esta entidad.")
        return value

    def validate(self, attrs):
        entity = self.context["entity"]
        catalogo_id = attrs["catalogo_id"]
        anio = attrs["anio"]
        qs = PlanInstitucional.objects.filter(entity=entity, catalogo_id=catalogo_id, anio=anio)
        if self.context.get("instance"):
            qs = qs.exclude(pk=self.context["instance"].pk)
        if qs.exists():
            raise serializers.ValidationError(
                {"anio": "Ya existe un plan de este catálogo para la vigencia indicada."}
            )
        return attrs

    def resolve_secretaria(self, entity) -> Secretaria | None:
        sid = self.validated_data.get("responsable_secretaria_id")
        if sid is None:
            return None
        return Secretaria.objects.filter(pk=sid, entity=entity, is_active=True).first()


class PlanActividadWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanActividad
        fields = (
            "plan",
            "anio",
            "trimestre",
            "nombre",
            "descripcion",
            "meta",
            "indicador",
            "fecha_inicio",
            "fecha_fin",
            "responsable_secretaria",
            "responsable_usuario",
            "estado",
            "avance",
        )

    def validate_trimestre(self, value):
        if value not in Trimestre.values:
            raise serializers.ValidationError("Trimestre inválido (1-4).")
        return value

    def validate_estado(self, value):
        if value not in ActividadEstado.values:
            raise serializers.ValidationError("Estado inválido.")
        return value

    def validate_avance(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("El avance debe estar entre 0 y 100.")
        return value


class PlanCatalogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanCatalogo
        fields = (
            "id",
            "entity",
            "codigo",
            "nombre",
            "orden",
            "es_decreto612",
            "descripcion",
            "is_active",
        )
        read_only_fields = ("id",)


class PlanCatalogoWriteSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=64)
    nombre = serializers.CharField(max_length=512)
    descripcion = serializers.CharField(required=False, allow_blank=True, default="")
    orden = serializers.IntegerField(required=False, default=99)

    def validate_codigo(self, value):
        return value.strip().lower().replace(" ", "_")
