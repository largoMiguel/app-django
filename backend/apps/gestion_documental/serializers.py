"""Serializers — Gestión documental."""
from __future__ import annotations

from rest_framework import serializers

from apps.entities.models import Secretaria

from .models import (
    Disposicion,
    DocumentoExpediente,
    Expediente,
    FuidRegistro,
    InstrumentoArchivistico,
    SerieDocumental,
    Transferencia,
    UnidadAdministrativa,
)
from .services import archivo_url


class InstrumentoListSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    archivo_url = serializers.SerializerMethodField()

    class Meta:
        model = InstrumentoArchivistico
        fields = (
            "id",
            "tipo",
            "tipo_label",
            "vigencia",
            "version",
            "estado",
            "estado_label",
            "titulo",
            "codigo_rusd",
            "nombre_archivo",
            "archivo_url",
            "size",
            "fecha_convalidacion",
            "updated_at",
        )

    def get_archivo_url(self, obj) -> str | None:
        return archivo_url(obj.b2_key, obj.nombre_archivo)


class InstrumentoWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstrumentoArchivistico
        fields = (
            "tipo",
            "vigencia",
            "version",
            "estado",
            "titulo",
            "acta_comite",
            "fecha_aprobacion_comite",
            "fecha_convalidacion",
            "codigo_rusd",
            "notas",
        )


class UnidadAdministrativaSerializer(serializers.ModelSerializer):
    secretaria_nombre = serializers.CharField(source="secretaria.nombre", read_only=True, default="")

    class Meta:
        model = UnidadAdministrativa
        fields = ("id", "codigo", "nombre", "secretaria", "secretaria_nombre", "is_active", "created_at")
        read_only_fields = ("created_at",)


class SerieListSerializer(serializers.ModelSerializer):
    parent_codigo = serializers.CharField(source="parent.codigo", read_only=True, default="")
    unidad_nombre = serializers.CharField(source="unidad.nombre", read_only=True, default="")
    disposicion_label = serializers.CharField(source="get_disposicion_final_display", read_only=True)

    class Meta:
        model = SerieDocumental
        fields = (
            "id",
            "codigo",
            "nombre",
            "es_subserie",
            "parent",
            "parent_codigo",
            "unidad",
            "unidad_nombre",
            "tipos_documentales",
            "retencion_gestion_anios",
            "retencion_central_anios",
            "disposicion_final",
            "disposicion_label",
            "procedimiento",
            "instrumento",
            "is_active",
        )


class SerieWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SerieDocumental
        fields = (
            "codigo",
            "nombre",
            "es_subserie",
            "parent",
            "unidad",
            "tipos_documentales",
            "retencion_gestion_anios",
            "retencion_central_anios",
            "disposicion_final",
            "procedimiento",
            "instrumento",
            "is_active",
        )


class DocumentoExpedienteSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()
    uploaded_by_nombre = serializers.CharField(source="uploaded_by.full_name", read_only=True, default="")

    class Meta:
        model = DocumentoExpediente
        fields = (
            "id",
            "nombre",
            "tipo_documental",
            "archivo_url",
            "content_type",
            "size",
            "sha256",
            "version",
            "folio_inicio",
            "folio_fin",
            "fecha_documento",
            "uploaded_by_nombre",
            "created_at",
        )

    def get_archivo_url(self, obj) -> str | None:
        return archivo_url(obj.b2_key, obj.nombre)


class ExpedienteListSerializer(serializers.ModelSerializer):
    serie_codigo = serializers.CharField(source="serie.codigo", read_only=True)
    serie_nombre = serializers.CharField(source="serie.nombre", read_only=True)
    secretaria_nombre = serializers.CharField(source="secretaria.nombre", read_only=True, default="")
    etapa_label = serializers.CharField(source="get_etapa_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    documentos_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Expediente
        fields = (
            "id",
            "codigo",
            "titulo",
            "serie",
            "serie_codigo",
            "serie_nombre",
            "secretaria",
            "secretaria_nombre",
            "etapa",
            "etapa_label",
            "estado",
            "estado_label",
            "soporte",
            "fecha_extrema_inicial",
            "fecha_extrema_final",
            "folios",
            "documentos_count",
            "updated_at",
        )


class ExpedienteDetailSerializer(ExpedienteListSerializer):
    documentos = DocumentoExpedienteSerializer(many=True, read_only=True)
    notas = serializers.CharField()

    class Meta(ExpedienteListSerializer.Meta):
        fields = ExpedienteListSerializer.Meta.fields + (
            "unidad",
            "responsable",
            "notas",
            "documentos",
            "created_at",
        )


class ExpedienteWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expediente
        fields = (
            "codigo",
            "titulo",
            "serie",
            "unidad",
            "secretaria",
            "responsable",
            "soporte",
            "fecha_extrema_inicial",
            "fecha_extrema_final",
            "folios",
            "notas",
        )

    def validate_serie(self, value):
        entity = self.context.get("entity")
        if entity and value.entity_id != entity.id:
            raise serializers.ValidationError("Serie de otra entidad.")
        return value

    def validate_secretaria(self, value):
        if value is None:
            return value
        entity = self.context.get("entity")
        if entity and value.entity_id != entity.id:
            raise serializers.ValidationError("Secretaría de otra entidad.")
        return value


class FuidRegistroSerializer(serializers.ModelSerializer):
    expediente_codigo = serializers.CharField(source="expediente.codigo", read_only=True, default="")

    class Meta:
        model = FuidRegistro
        fields = (
            "id",
            "expediente",
            "expediente_codigo",
            "codigo",
            "serie_nombre",
            "subserie_nombre",
            "unidad_documental",
            "fecha_inicial",
            "fecha_final",
            "soporte_fisico",
            "soporte_electronico",
            "caja",
            "carpeta",
            "tomo",
            "folios",
            "ubicacion",
            "notas",
            "created_at",
        )


class TransferenciaListSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    expedientes_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Transferencia
        fields = (
            "id",
            "tipo",
            "tipo_label",
            "estado",
            "estado_label",
            "acta",
            "expedientes_count",
            "ejecutada_at",
            "notas",
            "created_at",
        )


class TransferenciaWriteSerializer(serializers.ModelSerializer):
    expediente_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        default=list,
    )

    class Meta:
        model = Transferencia
        fields = ("tipo", "acta", "notas", "expediente_ids")


class DisposicionSerializer(serializers.ModelSerializer):
    disposicion_label = serializers.CharField(source="get_disposicion_final_display", read_only=True)
    expediente_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        default=list,
    )

    class Meta:
        model = Disposicion
        fields = (
            "id",
            "disposicion_final",
            "disposicion_label",
            "acta",
            "notas",
            "expediente_ids",
            "created_at",
        )
