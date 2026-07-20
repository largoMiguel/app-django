"""Serializers Correspondencia."""
from __future__ import annotations

from rest_framework import serializers

from apps.entities.models import Secretaria

from .models import (
    CanalCorrespondencia,
    Correspondencia,
    CorrespondenciaAnexo,
    CorrespondenciaEvento,
    DIAS_HABILES_CHOICES,
    EstadoCorrespondencia,
    SentidoCorrespondencia,
    TipologiaCorrespondencia,
    TipoAnexo,
)
from .services import anexo_url, validate_canal_contacto


class CorrespondenciaAnexoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_nombre = serializers.CharField(
        source="uploaded_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = CorrespondenciaAnexo
        fields = (
            "id",
            "tipo",
            "nombre",
            "content_type",
            "size",
            "url",
            "uploaded_by",
            "uploaded_by_nombre",
            "created_at",
        )
        read_only_fields = fields

    def get_url(self, obj) -> str | None:
        return anexo_url(obj)


class CorrespondenciaEventoSerializer(serializers.ModelSerializer):
    actor_nombre = serializers.CharField(source="actor.full_name", read_only=True, default=None)

    class Meta:
        model = CorrespondenciaEvento
        fields = ("id", "tipo", "detalle", "actor", "actor_nombre", "created_at")
        read_only_fields = fields


class CorrespondenciaListSerializer(serializers.ModelSerializer):
    secretaria_nombre = serializers.CharField(source="secretaria.nombre", read_only=True)
    assigned_to_nombre = serializers.CharField(
        source="assigned_to.full_name", read_only=True, default=None
    )
    sla_status = serializers.SerializerMethodField()
    sentido_label = serializers.CharField(source="get_sentido_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    tipologia_label = serializers.CharField(source="get_tipologia_display", read_only=True)

    class Meta:
        model = Correspondencia
        fields = (
            "id",
            "numero_radicado",
            "sentido",
            "sentido_label",
            "tipologia",
            "tipologia_label",
            "fecha_radicacion",
            "remitente_nombre",
            "destinatario_nombre",
            "asunto",
            "canal",
            "secretaria",
            "secretaria_nombre",
            "assigned_to",
            "assigned_to_nombre",
            "estado",
            "estado_label",
            "dias_habiles_respuesta",
            "fecha_vencimiento",
            "sla_status",
            "created_at",
        )

    def get_sla_status(self, obj) -> str:
        return obj.sla_status()


class CorrespondenciaDetailSerializer(CorrespondenciaListSerializer):
    anexos = CorrespondenciaAnexoSerializer(many=True, read_only=True)
    eventos = CorrespondenciaEventoSerializer(many=True, read_only=True)
    created_by_nombre = serializers.CharField(
        source="created_by.full_name", read_only=True, default=None
    )

    class Meta(CorrespondenciaListSerializer.Meta):
        fields = CorrespondenciaListSerializer.Meta.fields + (
            "remitente_documento",
            "remitente_dependencia",
            "destinatario_documento",
            "destinatario_dependencia",
            "contacto_email",
            "contacto_direccion",
            "descripcion",
            "numero_folios",
            "respuesta_texto",
            "fecha_respuesta",
            "created_by",
            "created_by_nombre",
            "updated_at",
            "anexos",
            "eventos",
        )


class CorrespondenciaWriteSerializer(serializers.Serializer):
    sentido = serializers.ChoiceField(choices=SentidoCorrespondencia.choices)
    tipologia = serializers.ChoiceField(
        choices=TipologiaCorrespondencia.choices, default=TipologiaCorrespondencia.OFICIO
    )
    fecha_radicacion = serializers.DateTimeField(required=False)
    remitente_nombre = serializers.CharField(max_length=250)
    remitente_documento = serializers.CharField(max_length=50, required=False, allow_blank=True)
    remitente_dependencia = serializers.CharField(max_length=250, required=False, allow_blank=True)
    destinatario_nombre = serializers.CharField(max_length=250)
    destinatario_documento = serializers.CharField(max_length=50, required=False, allow_blank=True)
    destinatario_dependencia = serializers.CharField(
        max_length=250, required=False, allow_blank=True
    )
    canal = serializers.ChoiceField(choices=CanalCorrespondencia.choices)
    contacto_email = serializers.EmailField(required=False, allow_blank=True)
    contacto_direccion = serializers.CharField(max_length=400, required=False, allow_blank=True)
    asunto = serializers.CharField(max_length=500)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    numero_folios = serializers.IntegerField(min_value=1, default=1)
    secretaria_id = serializers.IntegerField()
    assigned_to_id = serializers.IntegerField(required=False, allow_null=True)
    dias_habiles_respuesta = serializers.ChoiceField(
        choices=[c[0] for c in DIAS_HABILES_CHOICES],
        default=15,
    )

    def validate(self, attrs):
        validate_canal_contacto(
            canal=attrs["canal"],
            email=attrs.get("contacto_email", ""),
            direccion=attrs.get("contacto_direccion", ""),
        )
        return attrs

    def resolve_secretaria(self, entity):
        sec_id = self.validated_data["secretaria_id"]
        sec = Secretaria.objects.filter(pk=sec_id, entity=entity, is_active=True).first()
        if not sec:
            raise serializers.ValidationError({"secretaria_id": "Secretaría inválida."})
        return sec


class AsignarSerializer(serializers.Serializer):
    secretaria_id = serializers.IntegerField()
    assigned_to_id = serializers.IntegerField(required=False, allow_null=True)


class CambiarEstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=EstadoCorrespondencia.choices)


class ResponderSerializer(serializers.Serializer):
    respuesta_texto = serializers.CharField()


class AnexoUploadSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=TipoAnexo.choices, default=TipoAnexo.SOLICITUD)
    file = serializers.FileField()
