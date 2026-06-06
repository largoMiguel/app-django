"""PQRS endpoints — admin/secretario flow."""
from __future__ import annotations

import html
import logging

from django.core.files.base import ContentFile
from django.db.models import Count
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.modules import require_user_module
from apps.common.pagination import StandardPageNumberPagination
from apps.entities.models import Secretaria
from apps.rbac.permissions import HasPermOrRole

from apps.common.roles import is_platform_superadmin, user_roles
from .access import pqrs_queryset_for_user
from .models import (
    DIAS_RESPUESTA_LEY1755,
    EstadoPQRS,
    PQRS,
    AsignacionAuditoria,
    PQRSArchivo,
    sumar_dias_habiles,
)
from .serializers import (
    AsignarSerializer,
    PQRSListSerializer,
    PQRSReportRowSerializer,
    PQRSArchivoSerializer,
    PQRSSerializer,
    RechazarAsignacionSerializer,
    ResponderSerializer,
)
from .services.ai import extraer_pqrs_con_ia
from .filters import PQRSFilterSet
from .stats import compute_pqrs_stats
from .throttles import PQRSAIAutoCreateThrottle
from .validators import validate_uploaded_file

logger = logging.getLogger(__name__)

MAX_ARCHIVOS = PQRSArchivo.MAX_ARCHIVOS


def _enviar_respuesta_email(pqrs: PQRS, texto_respuesta: str, email_destino: str) -> tuple[bool, str | None]:
    """Envía la respuesta de la PQRS al ciudadano por correo electrónico."""
    from django.conf import settings
    from django.core.mail import send_mail

    entity_name = pqrs.entity.name if pqrs.entity else "la entidad"
    safe_entity = html.escape(entity_name)
    safe_texto = html.escape(texto_respuesta)
    tipo_labels = {
        "peticion": "Petición",
        "queja": "Queja",
        "reclamo": "Reclamo",
        "sugerencia": "Sugerencia",
        "denuncia": "Denuncia",
        "felicitacion": "Felicitación",
        "solicitud_informacion": "Solicitud de Información",
        "copia": "Copia",
        "otro": "Solicitud",
    }
    tipo_label = tipo_labels.get(pqrs.tipo_solicitud, "Solicitud")
    subject = f"Respuesta a su {tipo_label} No. {pqrs.numero_radicado}"

    fecha_str = (
        pqrs.fecha_respuesta.strftime("%d/%m/%Y %H:%M")
        if pqrs.fecha_respuesta
        else timezone.now().strftime("%d/%m/%Y %H:%M")
    )

    text_body = (
        f"Estimado/a ciudadano/a,\n\n"
        f"{entity_name} ha dado respuesta a su {tipo_label} con número de radicado "
        f"{pqrs.numero_radicado}.\n\n"
        f"RESPUESTA:\n{texto_respuesta}\n\n"
        f"Fecha de respuesta: {fecha_str}\n\n"
        f"Atentamente,\n{entity_name}\n\n"
        f"Este mensaje es generado automáticamente. Por favor no responda a este correo."
    )

    html_body = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;
            border:1px solid #e2e8f0;border-radius:8px;">
  <div style="background:#1c2536;padding:20px;border-radius:6px 6px 0 0;">
    <h2 style="color:white;margin:0;font-size:16px;">Respuesta a su solicitud PQRS</h2>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">{safe_entity}</p>
  </div>
  <div style="padding:24px 20px;">
    <p style="color:#475569;font-size:14px;margin-bottom:16px;">Estimado/a ciudadano/a,</p>
    <p style="color:#475569;font-size:14px;">
      {safe_entity} ha dado respuesta a su <strong>{html.escape(tipo_label)}</strong>
      con número de radicado:
    </p>
    <div style="background:#f1f5f9;border-radius:6px;padding:12px 16px;margin:12px 0;
                font-size:15px;font-weight:bold;color:#1e293b;">
      {html.escape(pqrs.numero_radicado)}
    </div>
    <h3 style="color:#1e293b;font-size:13px;text-transform:uppercase;
               letter-spacing:0.5px;margin:20px 0 8px;">
      Respuesta:
    </h3>
    <div style="background:#f8fafc;border-left:3px solid #3eafd4;padding:14px 16px;
                border-radius:0 6px 6px 0;color:#334155;font-size:14px;
                line-height:1.6;white-space:pre-wrap;">
      {safe_texto}
    </div>
    <p style="color:#94a3b8;font-size:12px;margin-top:4px;">
      Fecha de respuesta: {html.escape(fecha_str)}
    </p>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;padding-top:16px;
              border-top:1px solid #e2e8f0;">
      Este mensaje es generado automáticamente. Por favor no responda a este correo.
    </p>
  </div>
</div>
"""
    try:
        recipient_list = [
            e.strip()
            for e in email_destino.replace(";", ",").split(",")
            if e.strip()
        ]
        if not recipient_list:
            return False, "No hay destinatarios válidos."
        send_mail(
            subject=subject,
            message=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            html_message=html_body,
            fail_silently=False,
        )
        logger.info(
            "Email de respuesta PQRS %s enviado a %s",
            pqrs.numero_radicado,
            ", ".join(recipient_list),
        )
        return True, None
    except Exception as exc:
        logger.warning(
            "No se pudo enviar email de respuesta PQRS %s a %s: %s",
            pqrs.numero_radicado,
            email_destino,
            exc,
        )
        return False, str(exc)[:500]


def _create_text_pdf(texto: str, asunto: str, radicado: str) -> bytes:
    """Genera un PDF con el texto completo del ciudadano."""
    from fpdf import FPDF

    def _safe(s: str) -> str:
        return s.encode("latin-1", errors="replace").decode("latin-1")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 10, _safe(f"Radicado: {radicado}"), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "B", 11)
    pdf.multi_cell(0, 7, _safe(asunto))
    pdf.ln(3)
    pdf.set_draw_color(180, 180, 180)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)

    pdf.set_font("Helvetica", size=10)
    pdf.multi_cell(0, 6, _safe(texto))
    return bytes(pdf.output())


def _roles(user) -> set[str]:
    return user_roles(user)


def _can_manage_pqrs(user) -> bool:
    if is_platform_superadmin(user):
        return False
    roles = _roles(user)
    return "admin" in roles


def _can_create_pqrs(user) -> bool:
    if is_platform_superadmin(user):
        return False
    roles = _roles(user)
    return bool({"admin", "ciudadano"} & roles)


def _ensure_pqrs_enabled(entity):
    if entity is None or not entity.enable_pqrs:
        raise PermissionDenied("El módulo PQRS está deshabilitado para esta entidad.")


def _ensure_user_pqrs_module(user):
    if is_platform_superadmin(user):
        raise PermissionDenied("El superadministrador no opera el módulo PQRS.")
    if not user.entity_id:
        raise PermissionDenied("Usuario sin entidad asignada.")
    require_user_module(user, "pqrs", message="El módulo PQRS no está habilitado para tu usuario.")


def _can_upload_archivos(user, pqrs: PQRS) -> bool:
    if is_platform_superadmin(user):
        return False
    roles = _roles(user)
    if "admin" in roles:
        return pqrs.estado != EstadoPQRS.CERRADA
    if pqrs.estado == EstadoPQRS.CERRADA:
        return False
    if "secretario" in roles:
        return pqrs.assigned_to_id == user.secretaria_id
    if "ciudadano" in roles:
        return pqrs.created_by_id == user.id and pqrs.estado == EstadoPQRS.RECIBIDA
    return False


_ASIGNABLE_STATES = frozenset({
    EstadoPQRS.RECIBIDA,
    EstadoPQRS.ASIGNADA,
    EstadoPQRS.RECHAZADA_ASIGNACION,
})


def _maybe_mark_en_proceso(pqrs: PQRS, user) -> None:
    """Secretario que adjunta archivos pasa la PQRS a 'en_proceso'."""
    roles = _roles(user)
    if (
        "secretario" in roles
        and pqrs.estado == EstadoPQRS.ASIGNADA
        and pqrs.assigned_to_id == user.secretaria_id
    ):
        pqrs.estado = EstadoPQRS.EN_PROCESO
        pqrs.save(update_fields=["estado", "updated_at"])


class PQRSViewSet(viewsets.ModelViewSet):
    """
    - admin: todas las PQRS de su entidad.
    - secretario: asignadas a su secretaría.
    - ciudadano: las que creó.
    """

    serializer_class = PQRSSerializer
    permission_classes = (IsAuthenticated,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    filterset_class = PQRSFilterSet
    search_fields = ("numero_radicado", "asunto", "nombre_ciudadano", "cedula_ciudadano")
    ordering_fields = ("fecha_solicitud", "created_at", "estado")
    pagination_class = StandardPageNumberPagination

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        _ensure_user_pqrs_module(request.user)

    def get_permissions(self):
        perm_map = {
            "list": [IsAuthenticated, HasPermOrRole(perms=("pqrs.view_pqrs",), roles=("admin", "secretario", "ciudadano"))],
            "retrieve": [IsAuthenticated, HasPermOrRole(perms=("pqrs.view_pqrs",), roles=("admin", "secretario", "ciudadano"))],
            "create": [IsAuthenticated, HasPermOrRole(perms=("pqrs.add_pqrs",), roles=("admin", "ciudadano"))],
            "update": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("admin",))],
            "partial_update": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("admin",))],
            "destroy": [IsAuthenticated, HasPermOrRole(perms=("pqrs.delete_pqrs",), roles=("admin",))],
            "asignar": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("admin",))],
            "rechazar_asignacion": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("secretario",))],
            "responder": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("admin", "secretario"))],
            "cerrar": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("admin",))],
            "reabrir": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("admin",))],
            "archivos": [IsAuthenticated, HasPermOrRole(perms=("pqrs.view_pqrs",), roles=("admin", "secretario", "ciudadano"))],
            "archivo_remove": [IsAuthenticated, HasPermOrRole(perms=("pqrs.change_pqrs",), roles=("admin",))],
            "stats": [IsAuthenticated, HasPermOrRole(perms=("pqrs.view_pqrs",), roles=("admin", "secretario"))],
            "auto_create": [IsAuthenticated, HasPermOrRole(perms=("pqrs.add_pqrs",), roles=("admin", "ciudadano"))],
            "reports_preview": [IsAuthenticated, HasPermOrRole(perms=("pqrs.view_pqrs",), roles=("admin",))],
        }
        classes = perm_map.get(self.action, [IsAuthenticated])
        return [permission() for permission in classes]

    def get_serializer_class(self):
        if self.action == "list":
            return PQRSListSerializer
        return PQRSSerializer

    def get_queryset(self):
        qs = PQRS.objects.select_related("entity", "assigned_to", "created_by")
        if self.action == "list":
            qs = qs.annotate(archivos_count=Count("archivos"))
        elif self.action in {"retrieve", "responder", "archivos", "archivo_remove", "asignar"}:
            qs = qs.prefetch_related(
                "archivos",
                "auditoria",
                "auditoria__secretaria_anterior",
                "auditoria__secretaria_nueva",
                "auditoria__usuario_anterior",
                "auditoria__usuario_nuevo",
            )
        return pqrs_queryset_for_user(self.request.user, qs)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Agregados para dashboard (sin traer todas las PQRS)."""
        qs = self.filter_queryset(self.get_queryset())
        return Response(compute_pqrs_stats(qs, request.user))

    @action(detail=False, methods=["get"], url_path="reports-preview")
    def reports_preview(self, request):
        require_user_module(
            request.user,
            "reports_pdf",
            message="El módulo de reportes no está habilitado para tu usuario.",
        )
        qs = self.filter_queryset(self.get_queryset())
        max_rows = 20000
        total = qs.count()
        rows_qs = qs.order_by("-fecha_solicitud", "-id")[:max_rows]
        rows = PQRSReportRowSerializer(rows_qs, many=True).data
        return Response(
            {
                "total": total,
                "truncated": total > max_rows,
                "max_rows": max_rows,
                "stats": compute_pqrs_stats(qs, request.user),
                "rows": rows,
            }
        )

    def update(self, request, *args, **kwargs):
        if not _can_manage_pqrs(request.user):
            raise PermissionDenied("Solo admin puede editar PQRS.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not _can_manage_pqrs(request.user):
            raise PermissionDenied("Solo admin puede editar PQRS.")
        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        roles = _roles(user)

        if not _can_create_pqrs(user):
            raise PermissionDenied("Tu rol no puede crear PQRS.")

        if not user.entity_id:
            raise PermissionDenied("Usuario sin entidad asignada.")
        entity = user.entity

        _ensure_pqrs_enabled(entity)

        with transaction.atomic():
            numero = PQRS.generar_radicado(entity.id)
            tipo = str(serializer.validated_data.get("tipo_solicitud", "otro"))
            dias = DIAS_RESPUESTA_LEY1755.get(tipo, 15)
            fecha_solicitud_base = serializer.validated_data.get("fecha_solicitud") or timezone.now()
            fecha_venc = sumar_dias_habiles(fecha_solicitud_base, dias)
            pqrs = serializer.save(
                entity=entity,
                created_by=user,
                numero_radicado=numero,
                estado=EstadoPQRS.RECIBIDA,
                dias_respuesta=dias,
                fecha_vencimiento=fecha_venc,
            )
        # Adjuntos múltiples (multipart con campo "archivos")
        files = self.request.FILES.getlist("archivos") or self.request.FILES.getlist("archivos[]")
        if files:
            _attach_archivos(pqrs, files, user)

    def perform_update(self, serializer):
        instance = serializer.instance
        user = serializer.context["request"].user
        vdata = serializer.validated_data

        new_tipo = str(vdata.get("tipo_solicitud", instance.tipo_solicitud))
        new_fecha = vdata.get("fecha_solicitud") or instance.fecha_solicitud or timezone.now()
        dias = DIAS_RESPUESTA_LEY1755.get(new_tipo, 15)
        fecha_venc = sumar_dias_habiles(new_fecha, dias)

        # Registrar qué cambió
        cambios = []
        if "tipo_solicitud" in vdata and str(vdata["tipo_solicitud"]) != instance.tipo_solicitud:
            cambios.append(f"Tipo: {instance.tipo_solicitud} → {vdata['tipo_solicitud']}")
        if "fecha_solicitud" in vdata:
            old_d = instance.fecha_solicitud.date() if instance.fecha_solicitud else None
            new_d = vdata["fecha_solicitud"].date() if vdata.get("fecha_solicitud") else None
            if old_d != new_d:
                cambios.append(f"Fecha solicitud: {old_d} → {new_d}")
        if "asunto" in vdata and vdata["asunto"] != instance.asunto:
            cambios.append("Asunto modificado")
        if "descripcion" in vdata and vdata["descripcion"] != instance.descripcion:
            cambios.append("Descripción modificada")
        if "nombre_ciudadano" in vdata and vdata.get("nombre_ciudadano") != instance.nombre_ciudadano:
            cambios.append("Datos del ciudadano modificados")

        with transaction.atomic():
            serializer.save(dias_respuesta=dias, fecha_vencimiento=fecha_venc)
            if cambios:
                AsignacionAuditoria.objects.create(
                    pqrs=instance,
                    usuario_nuevo=user,
                    accion="edicion",
                    justificacion="; ".join(cambios),
                )
        # Adjuntos nuevos en multipart
        files = self.request.FILES.getlist("archivos") or self.request.FILES.getlist("archivos[]")
        if files:
            _attach_archivos(instance, files, user)

    def destroy(self, request, *args, **kwargs):
        if not _can_manage_pqrs(request.user):
            raise PermissionDenied("Solo admin puede eliminar PQRS.")
        return super().destroy(request, *args, **kwargs)

    # ── Asignar / reasignar a una secretaria ──────────────────────────
    @action(detail=True, methods=["post"], url_path="asignar")
    def asignar(self, request, pk=None):
        pqrs = self.get_object()
        user = request.user
        if not _can_manage_pqrs(user):
            raise PermissionDenied("Solo admin puede asignar PQRS.")

        ser = AsignarSerializer(data=request.data, context={"entity_id": pqrs.entity_id})
        ser.is_valid(raise_exception=True)
        secretaria = Secretaria.objects.get(pk=ser.validated_data["secretaria_id"])
        if secretaria.entity_id != pqrs.entity_id:
            raise ValidationError({"secretaria_id": "La secretaría no pertenece a la entidad."})
        if not secretaria.is_active:
            raise ValidationError({"secretaria_id": "La secretaría está inactiva."})
        if pqrs.estado not in _ASIGNABLE_STATES:
            raise ValidationError(
                {"estado": "Solo se puede asignar una PQRS recibida, asignada o con asignación rechazada."}
            )

        accion = "reasignacion" if pqrs.assigned_to_id else "asignacion"
        with transaction.atomic():
            AsignacionAuditoria.objects.create(
                pqrs=pqrs,
                secretaria_anterior_id=pqrs.assigned_to_id,
                secretaria_nueva=secretaria,
                usuario_nuevo=user,
                accion=accion,
                justificacion=ser.validated_data.get("justificacion") or "",
            )
            pqrs.assigned_to = secretaria
            pqrs.estado = EstadoPQRS.ASIGNADA
            pqrs.fecha_delegacion = timezone.now()
            pqrs.justificacion_asignacion = ser.validated_data.get("justificacion") or ""
            pqrs.save(
                update_fields=[
                    "assigned_to",
                    "estado",
                    "fecha_delegacion",
                    "justificacion_asignacion",
                    "updated_at",
                ]
            )
        return Response(PQRSSerializer(pqrs).data)

    # ── Secretario rechaza la asignación con justificación ────────────
    @action(detail=True, methods=["post"], url_path="rechazar-asignacion")
    def rechazar_asignacion(self, request, pk=None):
        pqrs = self.get_object()
        user = request.user
        roles = _roles(user)
        if "secretario" not in roles:
            raise PermissionDenied("Solo secretario puede rechazar la asignación.")
        if pqrs.assigned_to_id != user.secretaria_id:
            raise PermissionDenied("No tienes esta PQRS asignada.")

        ser = RechazarAsignacionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        motivo = ser.validated_data["motivo"]

        with transaction.atomic():
            AsignacionAuditoria.objects.create(
                pqrs=pqrs,
                secretaria_anterior=pqrs.assigned_to,
                secretaria_nueva=None,
                usuario_anterior=user,
                accion="rechazo",
                justificacion=motivo,
            )
            pqrs.assigned_to = None
            pqrs.estado = EstadoPQRS.RECHAZADA_ASIGNACION
            pqrs.save(update_fields=["assigned_to", "estado", "updated_at"])
        return Response(PQRSSerializer(pqrs).data)

    # ── Secretario responde la PQRS ───────────────────────────────────
    @action(detail=True, methods=["post"], url_path="responder")
    def responder(self, request, pk=None):
        pqrs = self.get_object()
        user = request.user
        roles = _roles(user)
        if not ("admin" in roles or "secretario" in roles):
            raise PermissionDenied("Sin permiso para responder.")
        if "secretario" in roles and "admin" not in roles:
            if pqrs.assigned_to_id != user.secretaria_id:
                raise PermissionDenied("No tienes esta PQRS asignada.")

        if pqrs.estado == EstadoPQRS.RESPONDIDA:
            raise ValidationError({"detail": "Esta PQRS ya fue respondida."})
        if pqrs.estado not in (EstadoPQRS.ASIGNADA, EstadoPQRS.EN_PROCESO):
            raise ValidationError({"detail": "Solo se puede responder una PQRS asignada."})

        ser = ResponderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        # Soporte archivo via multipart
        archivo = request.FILES.get("archivo_respuesta")
        archivo_path = None
        if archivo:
            validate_uploaded_file(archivo.name, archivo.size, field="archivo_respuesta")
            from django.core.files.base import ContentFile

            from apps.common.storage_cleanup import delete_pqrs_storage_key
            from apps.common.storages import pqrs_storage_for_paths

            if pqrs.archivo_respuesta:
                delete_pqrs_storage_key(pqrs.archivo_respuesta)
            ext = (archivo.name.rsplit(".", 1)[-1] if "." in archivo.name else "bin")[:8]
            safe_name = f"pqrs/respuestas/{pqrs.id}_{int(timezone.now().timestamp())}.{ext}"
            storage = pqrs_storage_for_paths()
            archivo_path = storage.save(safe_name, ContentFile(archivo.read()))

        with transaction.atomic():
            AsignacionAuditoria.objects.create(
                pqrs=pqrs,
                secretaria_anterior=pqrs.assigned_to,
                usuario_anterior=user,
                accion="respuesta",
                justificacion=ser.validated_data["respuesta"][:500],
            )
            pqrs.respuesta = ser.validated_data["respuesta"]
            if archivo_path is not None:
                pqrs.archivo_respuesta = archivo_path
            pqrs.estado = EstadoPQRS.RESPONDIDA
            pqrs.fecha_respuesta = timezone.now()
            pqrs.save(
                update_fields=[
                    "respuesta",
                    "archivo_respuesta",
                    "estado",
                    "fecha_respuesta",
                    "updated_at",
                ]
            )

        # Notificación por email (opcional)
        enviar_email = ser.validated_data.get("enviar_email", False)
        email_destino = (ser.validated_data.get("email_destino") or "").strip()
        if not email_destino:
            email_destino = (pqrs.email_ciudadano or "").strip()
        if enviar_email:
            if not email_destino:
                raise ValidationError({"email_destino": "La PQRS no tiene email de ciudadano registrado."})
            registro = (pqrs.email_ciudadano or "").strip().lower()
            if email_destino.lower() != registro:
                raise ValidationError(
                    {"email_destino": "Solo se puede enviar al email registrado en la PQRS."}
                )
            ok, err = _enviar_respuesta_email(pqrs, ser.validated_data["respuesta"], email_destino)
            pqrs.email_enviado = ok
            pqrs.email_error = err or ""
            pqrs.save(update_fields=["email_enviado", "email_error", "updated_at"])

        return Response(PQRSSerializer(pqrs, context={"request": request}).data)

    # ── Cerrar PQRS (admin) ───────────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="cerrar")
    def cerrar(self, request, pk=None):
        pqrs = self.get_object()
        if not _can_manage_pqrs(request.user):
            raise PermissionDenied("Solo admin puede cerrar PQRS.")
        if pqrs.estado != EstadoPQRS.RESPONDIDA:
            raise ValidationError({"estado": "Solo se puede cerrar una PQRS respondida."})
        pqrs.estado = EstadoPQRS.CERRADA
        pqrs.fecha_cierre = timezone.now()
        pqrs.save(update_fields=["estado", "fecha_cierre", "updated_at"])
        return Response(PQRSSerializer(pqrs).data)

    # ── Reabrir PQRS respondida (admin) ────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="reabrir")
    def reabrir(self, request, pk=None):
        pqrs = self.get_object()
        user = request.user
        if not _can_manage_pqrs(user):
            raise PermissionDenied("Solo admin puede reabrir PQRS.")
        if pqrs.estado != EstadoPQRS.RESPONDIDA:
            raise ValidationError({"estado": "Solo se puede reabrir una PQRS respondida."})
        nuevo_estado = EstadoPQRS.ASIGNADA if pqrs.assigned_to_id else EstadoPQRS.RECIBIDA
        with transaction.atomic():
            AsignacionAuditoria.objects.create(
                pqrs=pqrs,
                usuario_nuevo=user,
                accion="reapertura",
                justificacion="PQRS reabierta por administrador.",
            )
            pqrs.estado = nuevo_estado
            pqrs.fecha_respuesta = None
            pqrs.respuesta = None
            if pqrs.archivo_respuesta:
                from apps.common.storage_cleanup import delete_pqrs_storage_key

                delete_pqrs_storage_key(pqrs.archivo_respuesta)
            pqrs.archivo_respuesta = None
            pqrs.email_enviado = False
            pqrs.email_error = ""
            pqrs.save(
                update_fields=[
                    "estado",
                    "fecha_respuesta",
                    "respuesta",
                    "archivo_respuesta",
                    "email_enviado",
                    "email_error",
                    "updated_at",
                ]
            )
        return Response(PQRSSerializer(pqrs, context={"request": request}).data)

    # ─── Adjuntos ──────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="archivos",
            parser_classes=(MultiPartParser, FormParser, JSONParser))
    def archivos(self, request, pk=None):
        pqrs = self.get_object()
        if request.method == "GET":
            ser = PQRSArchivoSerializer(pqrs.archivos.all(), many=True, context={"request": request})
            return Response(ser.data)
        if not _can_upload_archivos(request.user, pqrs):
            raise PermissionDenied("No puedes subir archivos a esta PQRS.")
        # POST: subir nuevos archivos (uno o más)
        files = request.FILES.getlist("archivos") or request.FILES.getlist("archivos[]")
        if not files and "archivo" in request.FILES:
            files = [request.FILES["archivo"]]
        if not files:
            raise ValidationError({"archivos": "Debes adjuntar al menos un archivo."})
        _attach_archivos(pqrs, files, request.user)
        _maybe_mark_en_proceso(pqrs, request.user)
        ser = PQRSArchivoSerializer(pqrs.archivos.all(), many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"archivos/(?P<archivo_id>\d+)")
    def archivo_remove(self, request, pk=None, archivo_id=None):
        pqrs = self.get_object()
        if not _can_manage_pqrs(request.user):
            raise PermissionDenied("Solo admin puede eliminar adjuntos.")
        try:
            arch = pqrs.archivos.get(pk=archivo_id)
        except PQRSArchivo.DoesNotExist:
            raise ValidationError({"archivo_id": "No existe."})
        if arch.archivo:
            arch.archivo.delete(save=False)
        arch.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ─── Creación automática via IA (OpenAI) ───────────────────────────
    @action(
        detail=False,
        methods=["post"],
        url_path="auto-create",
        parser_classes=(MultiPartParser, FormParser, JSONParser),
        throttle_classes=(PQRSAIAutoCreateThrottle,),
    )
    def auto_create(self, request):
        """Recibe texto libre y/o archivos. La IA estructura y crea la PQRS."""
        user = request.user

        if not _can_create_pqrs(user):
            raise PermissionDenied("Tu rol no puede crear PQRS.")

        if not user.entity_id:
            raise PermissionDenied("Usuario sin entidad asignada.")
        entity = user.entity
        _ensure_pqrs_enabled(entity)
        if not entity.enable_ai_reports:
            raise PermissionDenied("El módulo de IA no está habilitado para esta entidad.")
        texto = (request.data.get("texto") or "").strip()
        files = request.FILES.getlist("archivos") or request.FILES.getlist("archivos[]")
        if len(files) > MAX_ARCHIVOS:
            raise ValidationError({"archivos": f"Máximo {MAX_ARCHIVOS} archivos."})
        if not texto and not files:
            raise ValidationError({"texto": "Debes ingresar texto o adjuntar al menos un archivo."})

        # Cargar bytes en memoria para extracción + reposicionar para guardado
        archivos_para_ia: list[tuple[str, bytes]] = []
        for f in files:
            content = f.read()
            archivos_para_ia.append((f.name, content))
            f.seek(0)

        try:
            extraido = extraer_pqrs_con_ia(texto, archivos_para_ia, entity.id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:  # noqa: BLE001
            logger.exception("Error procesando PQRS con IA")
            return Response(
                {"detail": "No se pudo procesar con IA. Intenta de nuevo más tarde."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Los valores de canal/contacto provistos explícitamente por el usuario
        # tienen prioridad sobre lo que la IA infirió del texto.
        CANALES_VALIDOS = {"email", "telefono", "fisica", "presencial", "otro"}
        medio_manual = (request.data.get("medio_respuesta") or "").strip().lower()
        if medio_manual in CANALES_VALIDOS:
            extraido["medio_respuesta"] = medio_manual
        for campo in ("email_ciudadano", "telefono_ciudadano", "direccion_ciudadano"):
            valor = (request.data.get(campo) or "").strip()
            if valor:
                extraido[campo] = valor

        tipo = extraido["tipo_solicitud"]
        dias = DIAS_RESPUESTA_LEY1755.get(tipo, 15)
        fecha_base = timezone.now()
        fecha_venc = sumar_dias_habiles(fecha_base, dias)

        with transaction.atomic():
            numero = PQRS.generar_radicado(entity.id)
            pqrs = PQRS.objects.create(
                entity=entity,
                created_by=user,
                numero_radicado=numero,
                tipo_solicitud=tipo,
                asunto=extraido["asunto"],
                descripcion=extraido["descripcion"],
                tipo_persona=extraido.get("tipo_persona"),
                tipo_identificacion=extraido.get("tipo_identificacion") or "CC",
                cedula_ciudadano=extraido.get("cedula_ciudadano"),
                nombre_ciudadano=extraido.get("nombre_ciudadano"),
                email_ciudadano=extraido.get("email_ciudadano"),
                telefono_ciudadano=extraido.get("telefono_ciudadano"),
                direccion_ciudadano=extraido.get("direccion_ciudadano"),
                medio_respuesta=extraido["medio_respuesta"],
                canal_llegada=extraido["canal_llegada"],
                estado=EstadoPQRS.RECIBIDA,
                dias_respuesta=dias,
                fecha_solicitud=fecha_base,
                fecha_vencimiento=fecha_venc,
            )

            # Asignación automática si la IA detectó secretaría
            sec_id = extraido.get("secretaria_id")
            if sec_id:
                secretaria = Secretaria.objects.filter(
                    pk=sec_id, entity_id=entity.id, is_active=True
                ).first()
                if secretaria:
                    pqrs.assigned_to = secretaria
                    pqrs.estado = EstadoPQRS.ASIGNADA
                    pqrs.fecha_delegacion = timezone.now()
                    pqrs.justificacion_asignacion = (
                        f"[IA] {extraido.get('secretaria_justificacion') or 'Asignación automática'}"
                    )
                    pqrs.save(update_fields=[
                        "assigned_to", "estado", "fecha_delegacion",
                        "justificacion_asignacion", "updated_at",
                    ])
                    AsignacionAuditoria.objects.create(
                        pqrs=pqrs,
                        secretaria_nueva=secretaria,
                        usuario_nuevo=user,
                        accion="asignacion",
                        justificacion=f"[IA] {extraido.get('secretaria_justificacion') or ''}",
                    )

            AsignacionAuditoria.objects.create(
                pqrs=pqrs,
                usuario_nuevo=user,
                accion="creacion_ia",
                justificacion="PQRS creada automáticamente por IA (OpenAI).",
            )

            # Adjuntar PDF con el texto original completo del ciudadano
            if texto:
                pdf_bytes = _create_text_pdf(texto, extraido["asunto"], numero)
                arch_pdf = PQRSArchivo(
                    pqrs=pqrs,
                    nombre_original=f"solicitud_{numero}.pdf",
                    content_type="application/pdf",
                    size=len(pdf_bytes),
                    uploaded_by=user if getattr(user, "is_authenticated", False) else None,
                )
                arch_pdf.archivo.save(f"solicitud_{numero}.pdf", ContentFile(pdf_bytes), save=False)
                arch_pdf.save()

            if files:
                _attach_archivos(pqrs, files, user)

        ser = PQRSSerializer(pqrs, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)


# ─── Helpers ───────────────────────────────────────────────────────────
def _attach_archivos(pqrs: PQRS, files: list, user) -> None:
    existentes = pqrs.archivos.count()
    disponibles = MAX_ARCHIVOS - existentes
    if disponibles <= 0:
        raise ValidationError({"archivos": f"Ya se alcanzó el límite de {MAX_ARCHIVOS} archivos."})
    a_subir = files[:disponibles]
    if len(files) > disponibles:
        raise ValidationError(
            {"archivos": f"Solo puedes subir {disponibles} archivo(s) más (máx {MAX_ARCHIVOS})."}
        )
    for f in a_subir:
        filename = getattr(f, "name", "archivo")
        content = f.read() if hasattr(f, "read") else b""
        size = getattr(f, "size", len(content)) or len(content)
        validate_uploaded_file(filename, size)
        # Reposicionar para guardado real (FieldFile.save consumirá de su propio buffer)
        try:
            f.seek(0)
        except Exception:  # noqa: BLE001
            pass
        arch = PQRSArchivo(
            pqrs=pqrs,
            nombre_original=filename,
            content_type=getattr(f, "content_type", "") or "",
            size=size,
            uploaded_by=user if getattr(user, "is_authenticated", False) else None,
        )
        arch.archivo.save(filename, ContentFile(content), save=False)
        arch.save()
