"""Serializers — módulo Asistencia."""
from __future__ import annotations

from rest_framework import serializers

from .models import EquipoRegistro, Funcionario, RegistroAsistencia
from .services import foto_url_for_registro, label_for_tipo


class FuncionarioSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)
    face_enrolled = serializers.SerializerMethodField()
    face_samples = serializers.SerializerMethodField()

    class Meta:
        model = Funcionario
        fields = (
            "id",
            "entity",
            "cedula",
            "nombres",
            "apellidos",
            "nombre_completo",
            "email",
            "telefono",
            "cargo",
            "is_active",
            "face_enrolled",
            "face_samples",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "entity",
            "nombre_completo",
            "face_enrolled",
            "face_samples",
            "created_at",
            "updated_at",
        )

    def get_face_enrolled(self, obj) -> bool:
        if hasattr(obj, "face_templates_count"):
            return obj.face_templates_count > 0
        return obj.face_templates.exists()

    def get_face_samples(self, obj) -> int:
        if hasattr(obj, "face_templates_count"):
            return obj.face_templates_count
        return obj.face_templates.count()


class EquipoRegistroSerializer(serializers.ModelSerializer):
    entity_name = serializers.CharField(source="entity.name", read_only=True)
    is_paired = serializers.SerializerMethodField()

    class Meta:
        model = EquipoRegistro
        fields = (
            "id",
            "entity",
            "entity_name",
            "nombre",
            "ubicacion",
            "is_active",
            "is_paired",
            "paired_at",
            "last_seen_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "entity",
            "entity_name",
            "is_paired",
            "paired_at",
            "last_seen_at",
            "created_at",
            "updated_at",
        )

    def get_is_paired(self, obj) -> bool:
        return bool(obj.device_token_hash)


class EquipoPairingCodeSerializer(serializers.Serializer):
    pairing_code = serializers.CharField(read_only=True)
    expires_in_seconds = serializers.IntegerField(read_only=True)


class RegistroAsistenciaSerializer(serializers.ModelSerializer):
    funcionario_nombre = serializers.CharField(source="funcionario.nombre_completo", read_only=True)
    funcionario_cedula = serializers.CharField(source="funcionario.cedula", read_only=True)
    equipo_nombre = serializers.CharField(source="equipo.nombre", read_only=True)
    tipo_label = serializers.SerializerMethodField()
    foto_url = serializers.SerializerMethodField()

    class Meta:
        model = RegistroAsistencia
        fields = (
            "id",
            "entity",
            "funcionario",
            "funcionario_nombre",
            "funcionario_cedula",
            "equipo",
            "equipo_nombre",
            "tipo",
            "tipo_label",
            "fecha_hora",
            "foto_url",
            "created_at",
        )
        read_only_fields = fields

    def get_tipo_label(self, obj) -> str:
        return label_for_tipo(obj.tipo)

    def get_foto_url(self, obj) -> str | None:
        return foto_url_for_registro(obj)


class KioskPairRequestSerializer(serializers.Serializer):
    pairing_code = serializers.CharField(max_length=8)


class KioskRegistroRequestSerializer(serializers.Serializer):
    cedula = serializers.CharField(max_length=20)
    foto_base64 = serializers.CharField()
    idempotency_key = serializers.CharField(max_length=64)
    client_ts = serializers.DateTimeField(required=False, allow_null=True)


class FaceEnrollRequestSerializer(serializers.Serializer):
    descriptor = serializers.ListField(
        child=serializers.FloatField(),
        min_length=128,
        max_length=128,
    )
    foto_base64 = serializers.CharField()


class KioskFacialRegistroRequestSerializer(serializers.Serializer):
    descriptor = serializers.ListField(
        child=serializers.FloatField(),
        min_length=128,
        max_length=128,
    )
    foto_base64 = serializers.CharField()
    idempotency_key = serializers.CharField(max_length=64)
    liveness_passed = serializers.BooleanField()
    client_ts = serializers.DateTimeField(required=False, allow_null=True)
