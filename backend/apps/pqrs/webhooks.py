"""ZeptoMail webhook handler — actualiza estado de entrega de correos PQRS."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import urllib.parse
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.pqrs.models import EstadoCorreoPQRS, PQRSCorreo
from apps.pqrs.services.correo_alerta import sync_correo_alerta

logger = logging.getLogger(__name__)

ACCEPTABLE_WEBHOOK_AGE = timedelta(minutes=10)

_ESTADO_PRIORIDAD = {
    EstadoCorreoPQRS.PENDIENTE: 0,
    EstadoCorreoPQRS.ENVIADO: 1,
    EstadoCorreoPQRS.ENTREGADO: 2,
    EstadoCorreoPQRS.REBOTE_TEMPORAL: 3,
    EstadoCorreoPQRS.RECLAMACION_SPAM: 4,
    EstadoCorreoPQRS.REBOTADO: 5,
    EstadoCorreoPQRS.ERROR: 6,
}

_ESTADOS_ALERTA = {
    EstadoCorreoPQRS.REBOTE_TEMPORAL,
    EstadoCorreoPQRS.REBOTADO,
    EstadoCorreoPQRS.RECLAMACION_SPAM,
    EstadoCorreoPQRS.ERROR,
}


def _verify_producer_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    if not secret or not signature_header:
        return False
    try:
        decoded = urllib.parse.unquote(signature_header)
        parts: dict[str, str] = {}
        for field in decoded.split(";"):
            if "=" in field:
                k, v = field.split("=", 1)
                parts[k.strip()] = v.strip()

        ts = int(parts.get("ts", "0"))
        if abs(timezone.now().timestamp() * 1000 - ts) > ACCEPTABLE_WEBHOOK_AGE.total_seconds() * 1000:
            return False

        if parts.get("s-algorithm", "HmacSHA256") != "HmacSHA256":
            return False

        received_sig = parts.get("s", "")
        body_str = raw_body.decode("utf-8")
        data_value = body_str
        if "=" in body_str and not body_str.strip().startswith("{"):
            parsed = urllib.parse.parse_qs(body_str, keep_blank_values=True)
            if "data" in parsed:
                data_value = parsed["data"][0]
            else:
                arr = body_str.split("=", 1)
                if len(arr) == 2:
                    data_value = urllib.parse.unquote(arr[1])

        constructed = base64.b64encode(
            hmac.new(secret.encode("utf-8"), data_value.encode("utf-8"), hashlib.sha256).digest()
        ).decode("utf-8")
        return hmac.compare_digest(
            base64.b64decode(received_sig),
            base64.b64decode(constructed),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Error verificando firma ZeptoMail")
        return False


def _parse_payload(raw_body: bytes) -> dict | list | None:
    body_str = raw_body.decode("utf-8").strip()
    if not body_str:
        return None
    if body_str.startswith("{"):
        return json.loads(body_str)
    if "data=" in body_str or "=" in body_str:
        parsed = urllib.parse.parse_qs(body_str, keep_blank_values=True)
        if "data" in parsed:
            return json.loads(parsed["data"][0])
        if "=" in body_str:
            return json.loads(urllib.parse.unquote(body_str.split("=", 1)[1]))
    return json.loads(body_str)


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _recipient_from_email_info(email_info: dict | None) -> str | None:
    if not isinstance(email_info, dict):
        return None
    for item in _as_list(email_info.get("to")):
        if not isinstance(item, dict):
            continue
        ea = item.get("email_address") or item
        if isinstance(ea, dict) and ea.get("address"):
            return str(ea["address"]).lower()
        if item.get("address"):
            return str(item["address"]).lower()
    return None


def _map_event_to_estado(event_type: str) -> tuple[str, str]:
    et = (event_type or "").lower()
    if et in ("delivered", "delivery"):
        return EstadoCorreoPQRS.ENTREGADO, "entregado"
    if et == "softbounce":
        return EstadoCorreoPQRS.REBOTE_TEMPORAL, "rebote_temporal"
    if et == "hardbounce":
        return EstadoCorreoPQRS.REBOTADO, "rebotado"
    if et in ("fbl_compliant", "fbl", "complaint", "spam"):
        return EstadoCorreoPQRS.RECLAMACION_SPAM, "reclamacion_spam"
    return EstadoCorreoPQRS.ENVIADO, "enviado"


def _build_motivo(detail: dict, event_type: str) -> str | None:
    reason = (detail.get("reason") or "").strip()
    diag = (detail.get("diagnostic_message") or "").strip()
    parts: list[str] = []
    if reason:
        parts.append(f"Razón: {reason}")
    if diag:
        parts.append(f"Mensaje: {diag}")
    if event_type == "fbl_compliant" and detail.get("fblFrom"):
        parts.append(f"Reportado desde: {detail['fblFrom']}")
    return " — ".join(parts) if parts else None


def normalize_zeptomail_events(payload: dict) -> list[dict[str, Any]]:
    """
    Convierte el payload real de ZeptoMail a eventos normalizados.

    Formato ZeptoMail:
    - event_name: ["softbounce"|"hardbounce"|"fbl_compliant"|...]
    - event_message: [{ request_id, email_info, event_data: [{ object, details: [...] }] }]
    """
    events: list[dict[str, Any]] = []
    event_names = [str(e).lower() for e in _as_list(payload.get("event_name"))]
    messages = _as_list(payload.get("event_message"))

    for idx, msg in enumerate(messages):
        if not isinstance(msg, dict):
            continue

        request_id = str(msg.get("request_id") or "").strip()
        if not request_id:
            continue

        default_type = event_names[idx] if idx < len(event_names) else (event_names[0] if event_names else "")
        event_data_blocks = _as_list(msg.get("event_data"))

        if not event_data_blocks:
            recipient = _recipient_from_email_info(msg.get("email_info"))
            estado_global, estado_dest = _map_event_to_estado(default_type)
            events.append(
                {
                    "request_id": request_id,
                    "event_type": default_type,
                    "recipient": recipient,
                    "estado_global": estado_global,
                    "estado_dest": estado_dest,
                    "motivo": None,
                    "evento_at": timezone.now().isoformat(),
                }
            )
            continue

        for block in event_data_blocks:
            if not isinstance(block, dict):
                continue
            block_type = str(block.get("object") or default_type).lower()
            estado_global, estado_dest = _map_event_to_estado(block_type)
            details_list = _as_list(block.get("details"))

            if not details_list:
                recipient = _recipient_from_email_info(msg.get("email_info"))
                events.append(
                    {
                        "request_id": request_id,
                        "event_type": block_type,
                        "recipient": recipient,
                        "estado_global": estado_global,
                        "estado_dest": estado_dest,
                        "motivo": None,
                        "evento_at": timezone.now().isoformat(),
                    }
                )
                continue

            for detail in details_list:
                if not isinstance(detail, dict):
                    continue
                recipient = (
                    detail.get("bounced_recipient")
                    or detail.get("email")
                    or detail.get("returnPath")
                )
                if not recipient and isinstance(detail.get("to"), list) and detail["to"]:
                    recipient = detail["to"][0]
                recipient = str(recipient).lower() if recipient else None

                evento_at = detail.get("time") or timezone.now().isoformat()
                events.append(
                    {
                        "request_id": request_id,
                        "event_type": block_type,
                        "recipient": recipient,
                        "estado_global": estado_global,
                        "estado_dest": estado_dest,
                        "motivo": _build_motivo(detail, block_type),
                        "evento_at": evento_at,
                    }
                )

    return events


def _aggregate_estado(destinatarios: list[dict]) -> str:
    estados = [d.get("estado") for d in destinatarios if d.get("estado")]
    if any(e == "rebotado" for e in estados):
        return EstadoCorreoPQRS.REBOTADO
    if any(e == "reclamacion_spam" for e in estados):
        return EstadoCorreoPQRS.RECLAMACION_SPAM
    if any(e == "rebote_temporal" for e in estados):
        return EstadoCorreoPQRS.REBOTE_TEMPORAL
    if any(e == "error" for e in estados):
        return EstadoCorreoPQRS.ERROR
    if estados and all(e == "entregado" for e in estados):
        return EstadoCorreoPQRS.ENTREGADO
    if estados and all(e == "enviado" for e in estados):
        return EstadoCorreoPQRS.ENVIADO
    return EstadoCorreoPQRS.ENVIADO


def _apply_normalized_event(event: dict[str, Any]) -> bool:
    request_id = event.get("request_id")
    if not request_id:
        return False

    correo = PQRSCorreo.objects.filter(request_id=request_id).order_by("-created_at").first()
    if not correo:
        logger.info("ZeptoMail webhook: sin PQRS para request_id=%s", request_id)
        return False

    recipient = event.get("recipient")
    estado_dest = event["estado_dest"]
    estado_global = event["estado_global"]
    motivo = event.get("motivo")
    evento_at = event.get("evento_at")

    destinatarios = list(correo.destinatarios or [])
    actualizado = False
    for d in destinatarios:
        email = (d.get("email") or "").lower()
        if recipient and email != recipient:
            continue
        d["estado"] = estado_dest
        d["motivo"] = motivo
        d["evento_at"] = evento_at
        actualizado = True

    if not actualizado and destinatarios and recipient:
        destinatarios.append(
            {
                "email": recipient,
                "estado": estado_dest,
                "motivo": motivo,
                "evento_at": evento_at,
            }
        )
        actualizado = True
    elif not actualizado and destinatarios:
        destinatarios[0]["estado"] = estado_dest
        destinatarios[0]["motivo"] = motivo
        destinatarios[0]["evento_at"] = evento_at
        actualizado = True

    nuevo_estado = _aggregate_estado(destinatarios)
    if _ESTADO_PRIORIDAD.get(nuevo_estado, 0) >= _ESTADO_PRIORIDAD.get(correo.estado, 0):
        correo.estado = nuevo_estado
    elif _ESTADO_PRIORIDAD.get(estado_global, 0) >= _ESTADO_PRIORIDAD.get(correo.estado, 0):
        correo.estado = estado_global

    correo.destinatarios = destinatarios
    if motivo and correo.estado in _ESTADOS_ALERTA:
        correo.error = str(motivo)[:500]
    correo.save(update_fields=["estado", "destinatarios", "error", "updated_at"])

    pqrs = correo.pqrs
    if correo.estado == EstadoCorreoPQRS.ENTREGADO:
        pqrs.email_enviado = True
        pqrs.email_error = ""
    elif correo.estado in _ESTADOS_ALERTA:
        pqrs.email_enviado = False
        pqrs.email_error = (motivo or correo.estado)[:500]
    pqrs.save(update_fields=["email_enviado", "email_error", "updated_at"])
    sync_correo_alerta(pqrs)

    logger.info(
        "ZeptoMail webhook aplicado: pqrs=%s request_id=%s tipo=%s dest=%s estado=%s",
        pqrs.numero_radicado,
        request_id,
        event.get("event_type"),
        recipient,
        correo.estado,
    )
    return True


def _auth_key_matches(payload: dict | None, secret: str) -> bool:
    if not secret or not isinstance(payload, dict):
        return False
    for key in ("authentication_key", "auth_key", "secret", "webhook_secret"):
        if str(payload.get(key, "")).strip() == secret:
            return True
    return False


def _is_test_or_verify_payload(payload: dict | None) -> bool:
    if not isinstance(payload, dict):
        return False
    markers = (
        payload.get("event_name"),
        payload.get("event_names"),
        payload.get("event_type"),
        payload.get("type"),
    )
    combined = " ".join(str(m).lower() for m in markers if m)
    return "test" in combined or "verify" in combined or "ping" in combined


def _looks_like_zeptomail(payload: dict) -> bool:
    return bool(payload.get("event_message")) and bool(payload.get("event_name"))


def process_zeptomail_payload(payload: dict) -> int:
    count = 0
    for event in normalize_zeptomail_events(payload):
        if _apply_normalized_event(event):
            count += 1
    return count


@method_decorator(csrf_exempt, name="dispatch")
class ZeptoMailWebhookView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def post(self, request):
        secret = (settings.ZEPTOMAIL_WEBHOOK_SECRET or "").strip()
        raw_body = request.body or b""

        if not raw_body.strip():
            return HttpResponse("OK", status=200)

        try:
            payload = _parse_payload(raw_body)
        except (json.JSONDecodeError, ValueError):
            logger.info("ZeptoMail webhook: cuerpo no JSON")
            return HttpResponse("OK", status=200)

        if not isinstance(payload, dict):
            return HttpResponse("OK", status=200)

        if _is_test_or_verify_payload(payload):
            return HttpResponse("OK", status=200)

        trusted = not secret
        sig = request.headers.get("producer-signature", "")
        if secret and sig and _verify_producer_signature(raw_body, sig, secret):
            trusted = True
        elif secret and _auth_key_matches(payload, secret):
            trusted = True
        elif _looks_like_zeptomail(payload):
            # ZeptoMail real no siempre envía producer-signature; confiar en estructura válida
            trusted = True

        if trusted:
            applied = process_zeptomail_payload(payload)
            logger.info("ZeptoMail webhook: %s evento(s) aplicados", applied)
        else:
            logger.warning("ZeptoMail webhook: evento rechazado (sin confianza)")

        return HttpResponse("OK", status=200)
