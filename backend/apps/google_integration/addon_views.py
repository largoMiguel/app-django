"""HTTP endpoints para Google Workspace Add-on (Gmail)."""
from __future__ import annotations

import json
import logging

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.entities.models import Secretaria
from apps.google_integration.cards import (
    duplicate_card,
    error_card,
    open_card,
    preview_card,
    success_card,
)
from apps.google_integration.identity import (
    email_from_id_token_claims,
    extract_addon_auth,
    extract_gmail_message_context,
    verify_google_id_token,
)
from apps.google_integration.preview_cache import load_preview, store_preview
from apps.google_integration.services.radicar import (
    build_forward_meta,
    check_duplicate,
    ensure_entity,
    fetch_and_parse_message,
    radicate_from_preview,
    resolve_user_for_addon,
)
from apps.google_integration.throttles import GoogleAddonThrottle
from apps.pqrs.services.ai import extraer_pqrs_con_ia
from apps.pqrs.services.email_sanitize import apply_original_sender_to_extraction, scrub_entity_from_extraction

logger = logging.getLogger(__name__)


def _parse_event(request) -> dict:
    if request.data and isinstance(request.data, dict):
        return request.data
    try:
        body = request.body.decode("utf-8") if request.body else "{}"
        return json.loads(body) if body.strip() else {}
    except json.JSONDecodeError:
        return {}


def _form_inputs(event: dict) -> dict:
    common = event.get("commonEventObject") or {}
    form = common.get("formInputs") or {}
    out: dict = {}
    for key, wrapper in form.items():
        if not isinstance(wrapper, dict):
            continue
        if "stringInputs" in wrapper:
            vals = wrapper["stringInputs"].get("value") or []
            out[key] = vals[0] if vals else ""
        elif "selectionInputs" in wrapper or "selectionInput" in wrapper:
            sel = wrapper.get("selectionInputs") or wrapper.get("selectionInput") or {}
            choices = sel.get("value") or []
            out[key] = choices[0] if choices else ""
    action = event.get("action") or {}
    for param in action.get("parameters") or []:
        if isinstance(param, dict) and param.get("key"):
            out[param["key"]] = param.get("value", "")
    return out


def _addon_context(event: dict) -> tuple[str, str, str, str, str]:
    _user_oauth, user_id_token, system_id_token = extract_addon_auth(event)
    verify_google_id_token(system_id_token)
    claims = verify_google_id_token(user_id_token)
    google_email = email_from_id_token_claims(claims)
    message_id, thread_id, access_token = extract_gmail_message_context(event)
    return google_email, message_id, thread_id, access_token, user_id_token


@method_decorator(csrf_exempt, name="dispatch")
class GmailAddonOpenView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (GoogleAddonThrottle,)

    def post(self, request):
        event = _parse_event(request)
        if event:
            logger.info(
                "Gmail addon open: host=%s msg=%s",
                (event.get("commonEventObject") or {}).get("hostApp"),
                (event.get("gmail") or {}).get("messageId"),
            )
        return Response(open_card())


@method_decorator(csrf_exempt, name="dispatch")
class GmailAddonPreviewView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (GoogleAddonThrottle,)

    def post(self, request):
        event = _parse_event(request)
        try:
            google_email, message_id, _thread, access_token, _ = _addon_context(event)
            user = resolve_user_for_addon(google_email)
            entity = ensure_entity(user, google_email)

            existing = check_duplicate(google_email, message_id)
            if existing:
                return Response(duplicate_card(existing.numero_radicado, existing.id))

            parsed, _, _files, _ctypes, _warnings = fetch_and_parse_message(
                access_token, message_id, with_attachments=False
            )
            texto = parsed.text_body or ""
            if not texto and parsed.html_body:
                from apps.google_integration.mime_parse import html_to_text_simple

                texto = html_to_text_simple(parsed.html_body)
            subject_line = parsed.subject or ""
            if subject_line and subject_line.lower() not in texto.lower()[:300]:
                texto = f"Asunto: {subject_line}\n\n{texto}".strip()

            forward_meta = build_forward_meta(parsed)
            archivos_ia: list[tuple[str, bytes]] = []
            extraido = extraer_pqrs_con_ia(
                texto,
                archivos_ia,
                entity.id,
                inbound_entity_name=entity.name,
            )
            extraido = scrub_entity_from_extraction(extraido, entity, user)
            extraido = apply_original_sender_to_extraction(extraido, forward_meta, entity, user)

            secretarias = list(
                Secretaria.objects.filter(entity_id=entity.id, is_active=True).order_by("nombre")
            )
            sec_options = [(s.id, s.nombre) for s in secretarias]
            sec_ids = extraido.get("secretaria_ids") or []
            sec_id = sec_ids[0] if sec_ids else (secretarias[0].id if len(secretarias) == 1 else None)

            preview_token = store_preview(
                {
                    "extraido": extraido,
                    "texto": texto,
                    "message_id": message_id,
                    "google_email": google_email,
                    "entity_id": entity.id,
                }
            )

            return Response(
                preview_card(
                    preview_token=preview_token,
                    tipo=extraido.get("tipo_solicitud") or "peticion",
                    asunto=extraido.get("asunto") or subject_line or "PQRS",
                    nombre=extraido.get("nombre_ciudadano") or parsed.from_name or "",
                    email_ciudadano=extraido.get("email_ciudadano") or parsed.from_email or "",
                    secretaria_options=sec_options,
                    secretaria_id=sec_id,
                )
            )
        except PermissionError as exc:
            return Response(error_card(str(exc)))
        except ValueError as exc:
            return Response(error_card(str(exc)))
        except Exception as exc:  # noqa: BLE001
            logger.exception("Gmail addon preview error")
            return Response(error_card("No se pudo analizar el correo. Intente de nuevo."))


@method_decorator(csrf_exempt, name="dispatch")
class GmailAddonRadicateView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    throttle_classes = (GoogleAddonThrottle,)

    def post(self, request):
        event = _parse_event(request)
        form = _form_inputs(event)
        preview_token = (form.get("preview_token") or "").strip()
        if not preview_token:
            return Response(error_card("Sesión de vista previa expirada. Vuelva a «Radicar como PQRS»."))

        preview_payload = load_preview(preview_token)
        if not preview_payload:
            return Response(error_card("La vista previa expiró. Analice el correo nuevamente."))

        try:
            google_email, message_id, _thread, access_token, _ = _addon_context(event)
            if preview_payload.get("message_id") != message_id:
                return Response(error_card("El mensaje cambió. Genere la vista previa de nuevo."))
            if preview_payload.get("google_email", "").lower() != google_email.lower():
                return Response(error_card("La cuenta de Gmail no coincide con la vista previa."))

            user = resolve_user_for_addon(google_email)
            entity = ensure_entity(user, google_email)
            if entity.id != preview_payload.get("entity_id"):
                return Response(error_card("Entidad no coincide con la vista previa."))

            existing = check_duplicate(google_email, message_id)
            if existing:
                return Response(duplicate_card(existing.numero_radicado, existing.id))

            pqrs, warnings = radicate_from_preview(
                user=user,
                entity=entity,
                google_email=google_email,
                access_token=access_token,
                message_id=message_id,
                preview_payload=preview_payload,
                form_inputs=form,
            )
            if warnings:
                return Response(
                    error_card(
                        f"PQRS {pqrs.numero_radicado} radicada. Advertencias: "
                        + " ".join(warnings[:3])
                    )
                )
            return Response(success_card(pqrs.numero_radicado, pqrs.id))
        except PermissionError as exc:
            return Response(error_card(str(exc)))
        except ValueError as exc:
            return Response(error_card(str(exc)))
        except Exception as exc:  # noqa: BLE001
            logger.exception("Gmail addon radicate error")
            return Response(error_card(f"No se pudo radicar: {exc}"))
