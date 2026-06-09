"""Public PQRS endpoints — no authentication required."""
from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import (
    DIAS_RESPUESTA_LEY1755,
    EstadoPQRS,
    PQRS,
    sumar_dias_habiles,
)
from .services.email import enviar_radicacion
from .services.creation import MAX_ARCHIVOS, attach_archivos_from_uploads, crear_pqrs_desde_ia

logger = logging.getLogger(__name__)

CANALES_RESPUESTA_VALIDOS = {"email", "telefono", "fisica", "presencial", "otro"}


class PublicPQRSThrottle(AnonRateThrottle):
    scope = "pqrs_public"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _resolve_entity(ref: str):
    """Resolve entity by slug. Validates active + PQRS enabled."""
    from apps.entities.models import Entity

    try:
        entity = Entity.objects.get(slug=ref)
    except Entity.DoesNotExist:
        raise NotFound("Entidad no encontrada.")
    if not entity.is_active:
        raise PermissionDenied("Esta entidad no está activa.")
    if not entity.enable_pqrs:
        raise PermissionDenied("El módulo PQRS no está habilitado para esta entidad.")
    return entity


# ─── Views ────────────────────────────────────────────────────────────────────

class PublicEntityInfoView(APIView):
    """GET /api/v1/public/entity/<slug>/ — información pública de la entidad."""

    permission_classes = (AllowAny,)
    throttle_classes = (PublicPQRSThrottle,)

    def get(self, request, slug):
        entity = _resolve_entity(slug)
        return Response(
            {
                "id": entity.id,
                "name": entity.name,
                "slug": entity.slug,
                "logo_url": entity.logo_url,
                "address": entity.address,
                "phone": entity.phone,
                "email": entity.email,
                "description": entity.description,
                "horario_atencion": entity.horario_atencion,
                "enable_pqrs": entity.enable_pqrs,
                "enable_ai_reports": entity.enable_ai_reports,
            }
        )


class PublicPQRSCreateView(APIView):
    """
    POST /api/v1/public/entity/<slug>/pqrs/
    Crea una PQRS sin autenticación. canal_llegada siempre es "web".
    """

    permission_classes = (AllowAny,)
    throttle_classes = (PublicPQRSThrottle,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def post(self, request, slug):
        entity = _resolve_entity(slug)
        data = request.data

        anonimo = str(data.get("anonimo", "false")).lower() in ("true", "1", "yes")

        tipo = str(data.get("tipo_solicitud", "peticion")).lower()
        if tipo not in DIAS_RESPUESTA_LEY1755:
            tipo = "peticion"

        asunto = str(data.get("asunto", "")).strip()
        descripcion = str(data.get("descripcion", "")).strip()
        if not asunto or not descripcion:
            return Response(
                {"detail": "Asunto y descripción son obligatorios."},
                status=400,
            )

        medio = str(data.get("medio_respuesta", "otro")).lower()
        if medio not in CANALES_RESPUESTA_VALIDOS:
            medio = "otro"

        dias = DIAS_RESPUESTA_LEY1755.get(tipo, 15)
        fecha_base = timezone.now()
        fecha_venc = sumar_dias_habiles(fecha_base, dias)

        with transaction.atomic():
            numero = PQRS.generar_radicado(entity.id)
            pqrs = PQRS.objects.create(
                entity=entity,
                created_by=None,
                numero_radicado=numero,
                tipo_solicitud=tipo,
                asunto=asunto,
                descripcion=descripcion,
                tipo_persona=None if anonimo else (data.get("tipo_persona") or "natural"),
                tipo_identificacion=(data.get("tipo_identificacion") or "CC") if not anonimo else "CC",
                cedula_ciudadano=None if anonimo else (data.get("cedula_ciudadano") or None),
                nombre_ciudadano=None if anonimo else (data.get("nombre_ciudadano") or None),
                email_ciudadano=None if anonimo else (data.get("email_ciudadano") or None),
                telefono_ciudadano=None if anonimo else (data.get("telefono_ciudadano") or None),
                direccion_ciudadano=None if anonimo else (data.get("direccion_ciudadano") or None),
                medio_respuesta=medio,
                canal_llegada="web",
                estado=EstadoPQRS.RECIBIDA,
                dias_respuesta=dias,
                fecha_solicitud=fecha_base,
                fecha_vencimiento=fecha_venc,
            )

            files = request.FILES.getlist("archivos") or request.FILES.getlist("archivos[]")
            if files:
                if len(files) > MAX_ARCHIVOS:
                    return Response(
                        {"detail": f"Máximo {MAX_ARCHIVOS} archivos permitidos."},
                        status=400,
                    )
                attach_archivos_from_uploads(pqrs, files, None)

        if pqrs.email_ciudadano:
            transaction.on_commit(lambda: enviar_radicacion(pqrs))

        return Response(
            {
                "numero_radicado": pqrs.numero_radicado,
                "estado": pqrs.estado,
                "fecha_solicitud": pqrs.fecha_solicitud,
                "fecha_vencimiento": pqrs.fecha_vencimiento,
                "tipo_solicitud": pqrs.tipo_solicitud,
                "asunto": pqrs.asunto,
                "entity_name": entity.name,
            },
            status=201,
        )


class PublicPQRSAutoCreateView(APIView):
    """
    POST /api/v1/public/entity/<slug>/pqrs/auto/
    Crea una PQRS vía IA sin autenticación. canal_llegada siempre es "web".
    """

    permission_classes = (AllowAny,)
    throttle_classes = (PublicPQRSThrottle,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def post(self, request, slug):
        from .services.ai import extraer_pqrs_con_ia

        entity = _resolve_entity(slug)
        if not entity.enable_ai_reports:
            raise PermissionDenied("El módulo de IA no está habilitado para esta entidad.")

        texto = (request.data.get("texto") or "").strip()
        files = request.FILES.getlist("archivos") or request.FILES.getlist("archivos[]")

        if len(files) > MAX_ARCHIVOS:
            return Response(
                {"detail": f"Máximo {MAX_ARCHIVOS} archivos permitidos."},
                status=400,
            )
        if not texto and not files:
            return Response(
                {"detail": "Debes ingresar texto o adjuntar al menos un archivo."},
                status=400,
            )

        archivos_para_ia: list[tuple[str, bytes]] = []
        for f in files:
            content = f.read()
            archivos_para_ia.append((f.name, content))
            f.seek(0)

        try:
            extraido = extraer_pqrs_con_ia(texto, archivos_para_ia, entity.id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        except Exception:  # noqa: BLE001
            logger.exception("Error procesando PQRS pública con IA")
            return Response(
                {"detail": "No se pudo procesar con IA. Intenta de nuevo más tarde."},
                status=502,
            )

        # User-provided values override AI-extracted values
        medio_manual = (request.data.get("medio_respuesta") or "").strip().lower()
        if medio_manual in CANALES_RESPUESTA_VALIDOS:
            extraido["medio_respuesta"] = medio_manual
        for campo in ("email_ciudadano", "telefono_ciudadano", "direccion_ciudadano"):
            valor = (request.data.get(campo) or "").strip()
            if valor:
                extraido[campo] = valor

        tipo = extraido["tipo_solicitud"]
        fecha_base = timezone.now()

        try:
            pqrs = crear_pqrs_desde_ia(
                entity,
                extraido,
                created_by=None,
                texto=texto,
                files_uploads=files or None,
                canal_llegada="web",
                fecha_base=fecha_base,
            )
        except Exception as exc:  # noqa: BLE001
            from rest_framework.exceptions import ValidationError

            if isinstance(exc, ValidationError):
                return Response(exc.detail, status=400)
            raise

        if pqrs.email_ciudadano:
            transaction.on_commit(lambda: enviar_radicacion(pqrs))

        return Response(
            {
                "numero_radicado": pqrs.numero_radicado,
                "estado": pqrs.estado,
                "fecha_solicitud": pqrs.fecha_solicitud,
                "fecha_vencimiento": pqrs.fecha_vencimiento,
                "tipo_solicitud": pqrs.tipo_solicitud,
                "asunto": pqrs.asunto,
                "entity_name": entity.name,
                "datos_extraidos": {
                    "nombre": extraido.get("nombre_ciudadano"),
                    "email": extraido.get("email_ciudadano"),
                    "tipo": tipo,
                },
            },
            status=201,
        )
