"""API endpoints de IA: copilotos, borradores, búsqueda, alertas, insights."""
from __future__ import annotations

import logging

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.common.modules import require_user_module
from apps.common.roles import is_platform_superadmin, user_roles
from apps.entities.models import Entity

from .models import AIAlert, AIInteraction, CopilotConversation, CopilotMessage
from .serializers import (
    AIAlertSerializer,
    CopilotChatRequestSerializer,
    PQRSDraftRequestSerializer,
    SemanticSearchSerializer,
)
from .scoping import filter_alerts_for_user, pqrs_queryset_for_ai_user
from .services.embeddings import find_similar, semantic_search
from .services.global_copilot import run_global_copilot
from .services.insights import generate_pdm_insights, generate_pqrs_insights
from .services.pdm_anomalies import detect_pdm_anomalies, forecast_pdm_completion
from .services.pdm_copilot import run_pdm_copilot
from .services.pqrs_compliance import compute_compliance_stats, compute_sla_risk_scores
from .services.pqrs_draft import generate_pqrs_draft
from .services.reports import generate_pdm_narrative_report
from .tasks import generate_pdm_report_task, index_pqrs_embedding

logger = logging.getLogger(__name__)


def _ensure_entity_user(user):
    if is_platform_superadmin(user):
        raise PermissionDenied("Superadmin no opera módulos de entidad.")
    if not user.entity_id:
        raise PermissionDenied("Usuario sin entidad.")


def _get_history(conversation_id: int, user) -> list[dict[str, str]]:
    if not conversation_id:
        return []
    conv = CopilotConversation.objects.filter(id=conversation_id, user=user).first()
    if not conv:
        return []
    return [
        {"role": m.role, "content": m.content}
        for m in conv.messages.order_by("created_at")[:12]
    ]


class AIAlertViewSet(ReadOnlyModelViewSet):
    """Alertas proactivas de IA."""
    serializer_class = AIAlertSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        _ensure_entity_user(user)
        qs = AIAlert.objects.filter(entity_id=user.entity_id, is_dismissed=False)
        if self.request.query_params.get("unread"):
            qs = qs.filter(is_read=False)
        module = self.request.query_params.get("module")
        if module == "pqrs":
            qs = qs.filter(alert_type__in=[
                AIAlert.AlertType.PQRS_SLA_RISK,
                AIAlert.AlertType.PQRS_DUPLICATE,
            ])
        elif module == "pdm":
            qs = qs.filter(alert_type__in=[
                AIAlert.AlertType.PDM_ANOMALY,
                AIAlert.AlertType.PDM_FORECAST,
            ])
        qs = filter_alerts_for_user(user, qs)
        return qs.order_by("-created_at")[:100]

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        alert = self.get_object()
        alert.is_read = True
        alert.save(update_fields=["is_read"])
        return Response(AIAlertSerializer(alert).data)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        alert = self.get_object()
        alert.is_dismissed = True
        alert.save(update_fields=["is_dismissed"])
        return Response({"ok": True})


class PdmCopilotView(APIView):
    """Copiloto interno PDM."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        _ensure_entity_user(user)
        require_user_module(user, "pdm")
        entity = user.entity

        ser = CopilotChatRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message = ser.validated_data["message"]
        conv_id = ser.validated_data.get("conversation_id")

        history = _get_history(conv_id, user)
        try:
            result = run_pdm_copilot(entity, message, history, user_id=user.id)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error en copiloto PDM")
            return Response(
                {"detail": f"No se pudo procesar la consulta: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if conv_id:
            conv = CopilotConversation.objects.get(id=conv_id, user=user)
        else:
            conv = CopilotConversation.objects.create(
                entity=entity, user=user, copilot_type="pdm",
            )
        CopilotMessage.objects.create(conversation=conv, role="user", content=message)
        CopilotMessage.objects.create(
            conversation=conv, role="assistant",
            content=result["reply"], sources=result.get("sources", []),
        )
        conv.save(update_fields=["updated_at"])

        return Response({
            "reply": result["reply"],
            "sources": result.get("sources", []),
            "conversation_id": conv.id,
        })


class GlobalCopilotView(APIView):
    """Copiloto global PDM + PQRS."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        _ensure_entity_user(user)
        entity = user.entity

        ser = CopilotChatRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message = ser.validated_data["message"]
        conv_id = ser.validated_data.get("conversation_id")

        history = _get_history(conv_id, user)
        try:
            result = run_global_copilot(entity, message, history, user_id=user.id)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Error en copiloto global")
            return Response(
                {"detail": f"No se pudo procesar la consulta: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if conv_id:
            conv = CopilotConversation.objects.get(id=conv_id, user=user)
        else:
            conv = CopilotConversation.objects.create(
                entity=entity, user=user, copilot_type="global",
            )
        CopilotMessage.objects.create(conversation=conv, role="user", content=message)
        CopilotMessage.objects.create(
            conversation=conv, role="assistant",
            content=result["reply"], sources=result.get("sources", []),
        )
        conv.save(update_fields=["updated_at"])

        return Response({
            "reply": result["reply"],
            "sources": result.get("sources", []),
            "conversation_id": conv.id,
        })


class PQRSComplianceView(APIView):
    """Métricas de compliance SLA PQRS."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache

        user = request.user
        _ensure_entity_user(user)
        require_user_module(user, "pqrs")
        cache_key = f"pqrs:compliance:{user.id}:{user.entity_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        qs = pqrs_queryset_for_ai_user(user).filter(entity_id=user.entity_id)
        stats = compute_compliance_stats(user.entity_id, qs=qs)
        risks = compute_sla_risk_scores(user.entity_id, qs=qs)[:20]
        payload = {"compliance": stats, "sla_risks": risks}
        cache.set(cache_key, payload, 120)
        return Response(payload)


class PQRSInsightsView(APIView):
    """Insights narrativos PQRS para dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache

        user = request.user
        _ensure_entity_user(user)
        require_user_module(user, "pqrs")
        cache_key = f"pqrs:insights:{user.id}:{user.entity_id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        payload = generate_pqrs_insights(user.entity_id, user=user)
        cache.set(cache_key, payload, 300)
        return Response(payload)


class PdmInsightsView(APIView):
    """Insights narrativos PDM para dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        user = request.user
        _ensure_entity_user(user)
        require_user_module(user, "pdm")
        anio = request.query_params.get("anio")
        anio_int = int(anio) if anio else None
        return Response(generate_pdm_insights(user.entity_id, anio=anio_int, user=user))


class PdmAnomaliesView(APIView):
    """Anomalías PDM detectadas."""
    permission_classes = [IsAuthenticated]

    def get(self, request, slug):
        user = request.user
        _ensure_entity_user(user)
        require_user_module(user, "pdm")
        anio = request.query_params.get("anio")
        anio_int = int(anio) if anio else None
        from apps.ai.scoping import pdm_codigos_for_ai_user

        codigos = pdm_codigos_for_ai_user(user, user.entity)
        anomalies = detect_pdm_anomalies(
            user.entity_id,
            anio=anio_int,
            codigos=codigos,
        )
        forecasts = forecast_pdm_completion(user.entity_id, anio=anio_int)
        return Response({"anomalies": anomalies, "forecasts": forecasts})


class SemanticSearchView(APIView):
    """Búsqueda semántica unificada."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        _ensure_entity_user(user)
        require_user_module(user, "pqrs")
        ser = SemanticSearchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from apps.ai.models import ContentEmbedding
        from apps.ai.tasks import reindex_all_embeddings

        entity_id = user.entity_id
        indexed = ContentEmbedding.objects.filter(entity_id=entity_id).count()
        if indexed == 0:
            reindex_all_embeddings.delay(entity_id=entity_id)

        results = semantic_search(
            entity_id,
            ser.validated_data["query"],
            content_types=ser.validated_data.get("content_types"),
            limit=ser.validated_data.get("limit", 10),
        )
        mode = "semantic" if results and results[0].get("metadata", {}).get("search_mode") == "semantic" else (
            "keyword" if results else "none"
        )
        return Response({
            "results": results,
            "indexed_count": indexed,
            "search_mode": mode,
            "hint": (
                "Indexando PQRS en segundo plano. La búsqueda semántica estará lista en unos minutos."
                if indexed == 0
                else None
            ),
        })


class PdmReportView(APIView):
    """Generación de reporte narrativo PDM."""
    permission_classes = [IsAuthenticated]

    def post(self, request, slug):
        user = request.user
        _ensure_entity_user(user)
        require_user_module(user, "pdm")
        roles = user_roles(user)
        if "admin" not in roles:
            raise PermissionDenied("Solo admin puede generar reportes.")
        anio = int(request.data.get("anio", timezone.now().year))
        async_mode = request.data.get("async", False)
        if async_mode:
            generate_pdm_report_task.delay(user.entity_id, anio, user.id)
            return Response({"status": "processing", "anio": anio})
        report = generate_pdm_narrative_report(user.entity_id, anio=anio)
        return Response(report)


class AIUsageView(APIView):
    """Uso de tokens IA por entidad (últimos 30 días)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        _ensure_entity_user(user)
        roles = user_roles(user)
        if "admin" not in roles:
            raise PermissionDenied()
        since = timezone.now() - timezone.timedelta(days=30)
        qs = AIInteraction.objects.filter(entity_id=user.entity_id, created_at__gte=since)
        agg = qs.aggregate(
            total_tokens=Sum("total_tokens"),
            total_interactions=Count("id"),
        )
        by_feature = dict(
            qs.values("feature").annotate(
                tokens=Sum("total_tokens"), count=Count("id"),
            ).values_list("feature", "tokens")
        )
        return Response({
            "total_tokens": agg["total_tokens"] or 0,
            "total_interactions": agg["total_interactions"] or 0,
            "by_feature": by_feature,
        })


class PQRSStatusLookupView(APIView):
    """Lookup público de estado PQRS por radicado (sin auth)."""
    permission_classes = []  # público
    authentication_classes = []

    def get(self, request, slug):
        from apps.pqrs.models import PQRS
        from apps.pqrs.serializers import PQRSListSerializer

        numero = request.query_params.get("radicado", "").strip()
        if not numero:
            raise ValidationError({"radicado": "Requerido."})

        entity = Entity.objects.filter(slug=slug, enable_pqrs=True).first()
        if not entity:
            raise ValidationError({"detail": "Entidad no encontrada."})

        pqrs = PQRS.objects.filter(entity=entity, numero_radicado=numero).first()
        if not pqrs:
            return Response({"found": False})

        return Response({
            "found": True,
            "numero_radicado": pqrs.numero_radicado,
            "estado": pqrs.estado,
            "tipo_solicitud": pqrs.tipo_solicitud,
            "asunto": pqrs.asunto,
            "fecha_solicitud": pqrs.fecha_solicitud,
            "fecha_vencimiento": pqrs.fecha_vencimiento,
            "fecha_respuesta": pqrs.fecha_respuesta,
            "tiene_respuesta": bool(pqrs.respuesta),
        })
