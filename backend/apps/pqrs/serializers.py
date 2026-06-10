from rest_framework import serializers

from apps.common.file_delivery import signed_pdm_url, signed_pqrs_url
from apps.entities.models import Secretaria

from .models import PQRS, AsignacionAuditoria, PQRSArchivo, PQRSCorreo
from .services.email import parse_email_list


class PQRSArchivoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = PQRSArchivo
        fields = ("id", "nombre", "nombre_original", "content_type", "size", "url", "created_at")
        read_only_fields = fields

    def get_url(self, obj):
        if not obj.archivo:
            return None
        from django.conf import settings

        if settings.USE_B2_STORAGE and settings.FILE_DELIVERY_SIGNING_KEY:
            filename = obj.nombre_original or obj.archivo.name.rsplit("/", 1)[-1]
            return signed_pqrs_url(obj.archivo.name, filename=filename)

        request = self.context.get("request")
        url = obj.archivo.url
        if request and not url.startswith("http"):
            return request.build_absolute_uri(url)
        return url

    def get_nombre(self, obj):
        return obj.nombre_original or (obj.archivo.name.rsplit("/", 1)[-1] if obj.archivo else "")


class SecretariaAsignadaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()


class AsignacionAuditoriaSerializer(serializers.ModelSerializer):
    secretaria_anterior_nombre = serializers.CharField(
        source="secretaria_anterior.nombre", read_only=True, default=None
    )
    secretaria_nueva_nombre = serializers.CharField(
        source="secretaria_nueva.nombre", read_only=True, default=None
    )
    usuario_anterior_email = serializers.CharField(
        source="usuario_anterior.email", read_only=True, default=None
    )
    usuario_anterior_nombre = serializers.CharField(
        source="usuario_anterior.full_name", read_only=True, default=None
    )
    usuario_nuevo_email = serializers.CharField(
        source="usuario_nuevo.email", read_only=True, default=None
    )
    usuario_nuevo_nombre = serializers.CharField(
        source="usuario_nuevo.full_name", read_only=True, default=None
    )

    class Meta:
        model = AsignacionAuditoria
        fields = (
            "id",
            "accion",
            "justificacion",
            "secretaria_anterior",
            "secretaria_anterior_nombre",
            "secretaria_nueva",
            "secretaria_nueva_nombre",
            "usuario_anterior",
            "usuario_anterior_email",
            "usuario_anterior_nombre",
            "usuario_nuevo",
            "usuario_nuevo_email",
            "usuario_nuevo_nombre",
            "fecha_asignacion",
        )
        read_only_fields = fields


class PQRSCorreoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PQRSCorreo
        fields = (
            "id",
            "tipo",
            "asunto",
            "estado",
            "error",
            "request_id",
            "destinatarios",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class PQRSSerializer(serializers.ModelSerializer):
    assigned_to_nombre = serializers.CharField(
        source="assigned_to.nombre", read_only=True, default=None
    )
    assigned_secretarias = serializers.SerializerMethodField()
    auditoria = AsignacionAuditoriaSerializer(many=True, read_only=True)
    correos = PQRSCorreoSerializer(many=True, read_only=True)
    is_anonima = serializers.SerializerMethodField()
    archivo_respuesta_url = serializers.SerializerMethodField()
    archivos = PQRSArchivoSerializer(many=True, read_only=True)

    class Meta:
        model = PQRS
        fields = (
            "id",
            "entity",
            "created_by",
            "assigned_to",
            "assigned_to_nombre",
            "assigned_secretarias",
            "numero_radicado",
            "tipo_identificacion",
            "medio_respuesta",
            "nombre_ciudadano",
            "cedula_ciudadano",
            "telefono_ciudadano",
            "email_ciudadano",
            "direccion_ciudadano",
            "tipo_solicitud",
            "tipo_persona",
            "asunto",
            "descripcion",
            "estado",
            "canal_llegada",
            "dias_respuesta",
            "respuesta",
            "archivo_respuesta",
            "justificacion_asignacion",
            "email_enviado",
            "email_error",
            "correo_alerta",
            "fecha_solicitud",
            "fecha_cierre",
            "fecha_delegacion",
            "fecha_respuesta",
            "fecha_vencimiento",
            "created_at",
            "updated_at",
            "auditoria",
            "correos",
            "is_anonima",
            "archivo_respuesta_url",
            "archivos",
        )
        read_only_fields = (
            "numero_radicado",
            "entity",
            "created_by",
            "assigned_to",
            "estado",
            "respuesta",
            "archivo_respuesta",
            "justificacion_asignacion",
            "email_enviado",
            "email_error",
            "fecha_cierre",
            "fecha_delegacion",
            "fecha_respuesta",
            "fecha_vencimiento",
            "created_at",
            "updated_at",
            "auditoria",
            "correos",
            "assigned_to_nombre",
            "assigned_secretarias",
            "is_anonima",
            "archivo_respuesta_url",
            "archivos",
        )

    def get_assigned_secretarias(self, obj) -> list[dict]:
        secretarias = getattr(obj, "_prefetched_objects_cache", {}).get("assigned_secretarias")
        if secretarias is None:
            secretarias = obj.assigned_secretarias.order_by("nombre", "id")
        return [{"id": s.id, "nombre": s.nombre} for s in secretarias]

    def get_is_anonima(self, obj) -> bool:
        return not (obj.nombre_ciudadano and obj.nombre_ciudadano.strip())

    def get_archivo_respuesta_url(self, obj):
        f = obj.archivo_respuesta
        if not f:
            return None
        from django.conf import settings

        if settings.USE_B2_STORAGE and settings.FILE_DELIVERY_SIGNING_KEY:
            filename = f.rsplit("/", 1)[-1]
            return signed_pqrs_url(f, filename=filename)

        request = self.context.get("request")
        url = f if isinstance(f, str) else getattr(f, "url", None)
        if not url:
            return None
        if request and not url.startswith("http"):
            return request.build_absolute_uri(url if url.startswith("/") else f"/media/{url}")
        return url


class PQRSListSerializer(serializers.ModelSerializer):
    assigned_to_nombre = serializers.CharField(
        source="assigned_to.nombre", read_only=True, default=None
    )
    assigned_secretarias = serializers.SerializerMethodField()
    is_anonima = serializers.SerializerMethodField()
    archivos_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PQRS
        fields = (
            "id",
            "entity",
            "created_by",
            "assigned_to",
            "assigned_to_nombre",
            "assigned_secretarias",
            "numero_radicado",
            "tipo_solicitud",
            "asunto",
            "estado",
            "canal_llegada",
            "fecha_solicitud",
            "fecha_vencimiento",
            "created_at",
            "updated_at",
            "nombre_ciudadano",
            "is_anonima",
            "archivos_count",
        )
        read_only_fields = fields

    def get_assigned_secretarias(self, obj) -> list[dict]:
        secretarias = getattr(obj, "_prefetched_objects_cache", {}).get("assigned_secretarias")
        if secretarias is None:
            secretarias = obj.assigned_secretarias.order_by("nombre", "id")
        return [{"id": s.id, "nombre": s.nombre} for s in secretarias]

    def get_is_anonima(self, obj) -> bool:
        return not (obj.nombre_ciudadano and obj.nombre_ciudadano.strip())


class PQRSReportRowSerializer(serializers.ModelSerializer):
    assigned_to_nombre = serializers.CharField(source="assigned_to.nombre", read_only=True, default="")

    class Meta:
        model = PQRS
        fields = (
            "id",
            "numero_radicado",
            "tipo_solicitud",
            "nombre_ciudadano",
            "email_ciudadano",
            "estado",
            "assigned_to",
            "assigned_to_nombre",
            "fecha_solicitud",
            "fecha_vencimiento",
            "canal_llegada",
        )
        read_only_fields = fields


class AsignarSerializer(serializers.Serializer):
    secretaria_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        required=False,
    )
    secretaria_id = serializers.IntegerField(required=False)
    justificacion = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        ids = attrs.get("secretaria_ids")
        if not ids and attrs.get("secretaria_id") is not None:
            ids = [attrs["secretaria_id"]]
        if not ids:
            raise serializers.ValidationError(
                {"secretaria_ids": "Debes indicar al menos una secretaría."}
            )
        expected_entity_id = self.context.get("entity_id")
        seen: set[int] = set()
        ordered: list[int] = []
        for sec_id in ids:
            if sec_id in seen:
                continue
            secretaria = Secretaria.objects.filter(pk=sec_id, is_active=True).first()
            if not secretaria:
                raise serializers.ValidationError(
                    {"secretaria_ids": f"Secretaría {sec_id} no existe o está inactiva."}
                )
            if expected_entity_id and secretaria.entity_id != expected_entity_id:
                raise serializers.ValidationError(
                    {"secretaria_ids": "Una o más secretarías no pertenecen a la entidad de la PQRS."}
                )
            seen.add(sec_id)
            ordered.append(sec_id)
        attrs["secretaria_ids"] = ordered
        return attrs


class RechazarAsignacionSerializer(serializers.Serializer):
    motivo = serializers.CharField()


class ResponderSerializer(serializers.Serializer):
    respuesta = serializers.CharField()
    enviar_email = serializers.BooleanField(required=False, default=False)
    email_destino = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_email_destino(self, value):
        if not value or not str(value).strip():
            return ""
        try:
            emails = parse_email_list(str(value))
        except Exception as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return ", ".join(emails)


class ReenviarCorreoSerializer(serializers.Serializer):
    correo_id = serializers.IntegerField(required=False, allow_null=True)
    email_destino = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_email_destino(self, value):
        if not value or not str(value).strip():
            return ""
        try:
            emails = parse_email_list(str(value))
        except Exception as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return ", ".join(emails)
