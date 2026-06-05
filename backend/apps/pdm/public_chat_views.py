"""Endpoints públicos del chat IA del PDM — sin autenticación."""
from __future__ import annotations

import hashlib
import logging
import uuid

from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.entities.models import Entity
from apps.entities.signals import default_pdm_chat_intro, default_pdm_chat_sugerencias

from .chat_service import chat_pdm
from .models import PdmChatConversation, PdmChatMessage

logger = logging.getLogger(__name__)


class PublicPdmChatThrottle(AnonRateThrottle):
    scope = "pdm_chat_public"


def _resolve_entity_for_chat(slug: str) -> Entity:
    try:
        entity = Entity.objects.get(slug=slug)
    except Entity.DoesNotExist:
        raise NotFound("Entidad no encontrada.")
    if not entity.is_active:
        raise PermissionDenied("Esta entidad no está activa.")
    if not entity.enable_pdm:
        raise PermissionDenied("El módulo PDM no está habilitado para esta entidad.")
    if not entity.enable_pdm_chat:
        raise PermissionDenied("El chat IA del PDM no está habilitado para esta entidad.")
    return entity


def _ip_hash(request) -> str:
    ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
    if not ip:
        ip = request.META.get("REMOTE_ADDR", "")
    return hashlib.sha256(ip.encode()).hexdigest()[:32] if ip else ""


class PublicPdmChatInfoView(APIView):
    """GET /api/v1/public/entity/<slug>/pdm-chat/info/"""

    permission_classes = (AllowAny,)
    throttle_classes = (PublicPdmChatThrottle,)

    def get(self, request, slug):
        entity = _resolve_entity_for_chat(slug)
        intro = (entity.pdm_chat_intro or "").strip() or default_pdm_chat_intro(entity)
        sugerencias = entity.pdm_chat_sugerencias or default_pdm_chat_sugerencias()
        return Response({
            "entity_id": entity.id,
            "name": entity.name,
            "slug": entity.slug,
            "logo_url": entity.logo_url,
            "plan_name": entity.plan_name,
            "intro": intro,
            "sugerencias": sugerencias,
            "enabled": True,
            "chat_url": f"/chat/{entity.slug}",
        })


class PublicPdmChatView(APIView):
    """POST /api/v1/public/entity/<slug>/pdm-chat/"""

    permission_classes = (AllowAny,)
    throttle_classes = (PublicPdmChatThrottle,)
    parser_classes = (JSONParser,)

    def post(self, request, slug):
        entity = _resolve_entity_for_chat(slug)
        data = request.data
        message = str(data.get("message") or "").strip()
        if not message:
            raise ValidationError({"message": "Este campo es obligatorio."})

        conversation_id = data.get("conversation_id")
        conversation: PdmChatConversation | None = None

        if conversation_id:
            try:
                conv_uuid = uuid.UUID(str(conversation_id))
                conversation = PdmChatConversation.objects.filter(
                    session_uuid=conv_uuid, entity=entity
                ).first()
            except (ValueError, TypeError):
                conversation = None

        history: list[dict[str, str]] = []
        if conversation:
            recent = list(conversation.messages.order_by("-created_at")[:16])
            recent.reverse()
            history = [{"role": m.role, "content": m.content} for m in recent]

        try:
            result = chat_pdm(entity, message, history=history)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        except Exception:  # noqa: BLE001
            logger.exception("Error en chat PDM público para %s", slug)
            return Response(
                {"detail": "No se pudo procesar la consulta. Intenta de nuevo más tarde."},
                status=502,
            )

        with transaction.atomic():
            if not conversation:
                conversation = PdmChatConversation.objects.create(
                    entity=entity,
                    session_uuid=uuid.uuid4(),
                    ip_hash=_ip_hash(request),
                    user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:500],
                )

            PdmChatMessage.objects.create(
                conversation=conversation,
                role=PdmChatMessage.Role.USER,
                content=message,
            )
            PdmChatMessage.objects.create(
                conversation=conversation,
                role=PdmChatMessage.Role.ASSISTANT,
                content=result["reply"],
                meta={"sources": result.get("sources", [])},
            )
            conversation.message_count = conversation.messages.count()
            conversation.save(update_fields=["message_count", "updated_at"])

        return Response({
            "conversation_id": str(conversation.session_uuid),
            "reply": result["reply"],
            "sources": result.get("sources", []),
        })
