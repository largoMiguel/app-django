"""Envío de correos PQRS vía ZeptoMail HTTP API."""
from __future__ import annotations

import base64
import html
import json
import logging
import mimetypes
import ssl
import urllib.error
import urllib.request
from typing import Any

import certifi
from django.conf import settings
from django.core.validators import EmailValidator
from django.utils import timezone

from apps.pqrs.models import (
    EstadoCorreoPQRS,
    PQRS,
    PQRSCorreo,
    TipoCorreoPQRS,
    TipoSolicitud,
)
from apps.common.datetime_fmt import format_fecha_co, format_fecha_hora_co, format_now_fecha_hora_co
from apps.common.roles import user_roles
from apps.pqrs.services.correo_alerta import (
    failed_recipients_from_correo,
    marcar_destinatarios_sustituidos,
    sync_correo_alerta,
)

logger = logging.getLogger(__name__)

_email_validator = EmailValidator()

TIPO_LABELS = {
    TipoSolicitud.PETICION: "Petición",
    TipoSolicitud.QUEJA: "Queja",
    TipoSolicitud.RECLAMO: "Reclamo",
    TipoSolicitud.SUGERENCIA: "Sugerencia",
    TipoSolicitud.DENUNCIA: "Denuncia",
    TipoSolicitud.FELICITACION: "Felicitación",
    TipoSolicitud.SOLICITUD_INFORMACION: "Solicitud de Información",
    TipoSolicitud.COPIA: "Copia",
    TipoSolicitud.OTRO: "Solicitud",
}


def merge_corrected_emails(pqrs: PQRS, correo: PQRSCorreo, corrected_raw: str) -> str:
    """Reemplaza en email_ciudadano solo los destinatarios que fallaron."""
    corrected = parse_email_list(corrected_raw)
    failed = failed_recipients_from_correo(correo)
    mapping: dict[str, str] = {}
    for i, failed_email in enumerate(failed):
        if i < len(corrected):
            mapping[failed_email.lower()] = corrected[i]
    try:
        existing = parse_email_list(pqrs.email_ciudadano or "")
    except ValueError:
        return ", ".join(corrected)
    merged: list[str] = []
    seen: set[str] = set()
    for em in existing:
        replacement = mapping.get(em.lower(), em)
        key = replacement.lower()
        if key not in seen:
            merged.append(replacement)
            seen.add(key)
    for em in corrected:
        key = em.lower()
        if key not in seen:
            merged.append(em)
            seen.add(key)
    return ", ".join(merged)


def parse_email_list(raw: str) -> list[str]:
    """Normaliza una lista de correos separados por coma o punto y coma."""
    emails: list[str] = []
    seen: set[str] = set()
    for part in raw.replace(";", ",").split(","):
        addr = part.strip()
        if not addr:
            continue
        lower = addr.lower()
        if lower in seen:
            continue
        _email_validator(addr)
        emails.append(addr)
        seen.add(lower)
    return emails


def _tipo_label(pqrs: PQRS) -> str:
    return TIPO_LABELS.get(pqrs.tipo_solicitud, "Solicitud")


def _entity_name(pqrs: PQRS) -> str:
    return pqrs.entity.name if pqrs.entity else "la entidad"


def _app_base_url() -> str:
    base = (getattr(settings, "APP_BASE_URL", "") or "").strip()
    if base:
        return base.rstrip("/")
    for origin in (getattr(settings, "CORS_ALLOWED_ORIGINS", "") or "").split(","):
        origin = origin.strip()
        if origin.startswith("https://"):
            return origin.rstrip("/")
    return "https://app.softone360.com"


def _pqrs_detail_url(pqrs: PQRS) -> str:
    return f"{_app_base_url()}/pqrs?id={pqrs.id}"


def _email_cta_button(url: str, label: str) -> str:
    safe_url = html.escape(url, quote=True)
    safe_label = html.escape(label)
    return f"""
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="{safe_url}"
         style="display:inline-block;background:#3eafd4;color:#ffffff;text-decoration:none;
                font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;">
        {safe_label}
      </a>
    </div>
    """


def _from_name(pqrs: PQRS, *, include_secretaria: bool = False) -> str:
    name = _entity_name(pqrs)
    if include_secretaria and pqrs.assigned_to and pqrs.assigned_to.nombre:
        return f"{name} - {pqrs.assigned_to.nombre}"
    return name


def _reply_to(pqrs: PQRS) -> list[dict[str, str]]:
    entity_email = (pqrs.entity.email or "").strip() if pqrs.entity else ""
    if not entity_email:
        return []
    return [{"address": entity_email, "name": _entity_name(pqrs)}]


def _guess_mime(name: str, content_type: str = "") -> str:
    if content_type:
        return content_type
    guessed, _ = mimetypes.guess_type(name)
    return guessed or "application/octet-stream"


def _read_bytes_from_storage(path: str) -> bytes:
    from apps.common.storages import pqrs_file_storage, pqrs_storage_for_paths

    storage = pqrs_storage_for_paths()
    try:
        with storage.open(path, "rb") as fh:
            return fh.read()
    except Exception:  # noqa: BLE001
        with pqrs_file_storage().open(path, "rb") as fh:
            return fh.read()


def _build_zeptomail_attachment(*, name: str, content: bytes, mime_type: str = "") -> dict[str, str]:
    return {
        "name": name[:200],
        "content": base64.b64encode(content).decode("ascii"),
        "mime_type": _guess_mime(name, mime_type),
    }


def _adjuntos_radicacion(pqrs: PQRS) -> list[dict[str, str]]:
    attachments: list[dict[str, str]] = []
    for arch in pqrs.archivos.all():
        if not arch.archivo:
            continue
        try:
            content = arch.archivo.read()
            arch.archivo.seek(0)
        except Exception:  # noqa: BLE001
            try:
                content = _read_bytes_from_storage(arch.archivo.name)
            except Exception as exc:  # noqa: BLE001
                logger.warning("No se pudo leer adjunto radicación %s: %s", arch.id, exc)
                continue
        nombre = arch.nombre_original or arch.archivo.name.rsplit("/", 1)[-1]
        attachments.append(
            _build_zeptomail_attachment(
                name=nombre,
                content=content,
                mime_type=arch.content_type,
            )
        )
    return attachments


def _adjuntos_respuesta(pqrs: PQRS) -> list[dict[str, str]]:
    path = pqrs.archivo_respuesta
    if not path:
        return []
    try:
        content = _read_bytes_from_storage(path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo leer adjunto respuesta PQRS %s: %s", pqrs.id, exc)
        return []
    nombre = path.rsplit("/", 1)[-1]
    return [_build_zeptomail_attachment(name=nombre, content=content)]


def _zeptomail_recipients(addrs: list[str]) -> list[dict[str, Any]]:
    return [
        {"email_address": {"address": addr, "name": addr.split("@")[0]}}
        for addr in addrs
    ]


def _cc_respondedor(enviado_por) -> list[str]:
    """Copia al correo del funcionario que responde (admin o secretario)."""
    if not enviado_por:
        return []
    roles = user_roles(enviado_por)
    if not (roles & {"admin", "secretario"}):
        return []
    email = (getattr(enviado_por, "email", None) or "").strip()
    return [email] if email else []


def _post_zeptomail(
    *,
    from_name: str,
    recipients: list[str],
    subject: str,
    html_body: str,
    text_body: str,
    reply_to: list[dict[str, str]] | None = None,
    attachments: list[dict[str, str]] | None = None,
    cc: list[str] | None = None,
) -> tuple[bool, str | None, str | None]:
    """Envía correo vía ZeptoMail. Retorna (ok, request_id, error)."""
    if not settings.PQRS_EMAIL_ENABLED:
        return False, None, "Correos PQRS deshabilitados (PQRS_EMAIL_ENABLED=false)."
    token = (settings.ZEPTOMAIL_TOKEN or "").strip()
    if not token:
        return False, None, "ZEPTOMAIL_TOKEN no configurado."

    to_lower = {addr.lower() for addr in recipients}
    cc_addrs = [addr for addr in (cc or []) if addr.lower() not in to_lower]

    payload: dict[str, Any] = {
        "from": {
            "address": settings.ZEPTOMAIL_FROM_EMAIL,
            "name": from_name,
        },
        "to": _zeptomail_recipients(recipients),
        "subject": subject,
        "htmlbody": html_body,
        "textbody": text_body,
        "track_opens": True,
    }
    if cc_addrs:
        payload["cc"] = _zeptomail_recipients(cc_addrs)
    if reply_to:
        payload["reply_to"] = reply_to
    if attachments:
        payload["attachments"] = attachments

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        settings.ZEPTOMAIL_API_URL,
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": token,
        },
        method="POST",
    )
    context = ssl.create_default_context(cafile=certifi.where())
    try:
        with urllib.request.urlopen(request, timeout=30, context=context) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            request_id = (
                data.get("request_id")
                or data.get("data", {}).get("request_id")
                or (data.get("data") or [{}])[0].get("request_id")
                if isinstance(data.get("data"), list)
                else None
            )
            if not request_id and isinstance(data.get("data"), dict):
                request_id = data["data"].get("request_id")
            return True, request_id, None
    except urllib.error.HTTPError as exc:
        try:
            err_body = exc.read().decode("utf-8")
            err_data = json.loads(err_body) if err_body else {}
            message = err_data.get("message") or err_data.get("error") or err_body
        except Exception:  # noqa: BLE001
            message = str(exc)
        return False, None, str(message)[:500]
    except Exception as exc:  # noqa: BLE001
        return False, None, str(exc)[:500]


def _wrap_html(entity_name: str, title: str, inner_html: str) -> str:
    safe_entity = html.escape(entity_name)
    return f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;
            border:1px solid #e2e8f0;border-radius:8px;">
  <div style="background:#1c2536;padding:20px;border-radius:6px 6px 0 0;">
    <h2 style="color:white;margin:0;font-size:16px;">{html.escape(title)}</h2>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">{safe_entity}</p>
  </div>
  <div style="padding:24px 20px;">
    {inner_html}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;padding-top:16px;
              border-top:1px solid #e2e8f0;">
      Este mensaje es generado automáticamente por el sistema de PQRS.
    </p>
  </div>
</div>
"""


def _build_radicacion_bodies(pqrs: PQRS) -> tuple[str, str, str]:
    entity_name = _entity_name(pqrs)
    tipo_label = _tipo_label(pqrs)
    subject = f"PQRS Radicada - {pqrs.numero_radicado}"
    fecha_sol = (
        format_fecha_hora_co(pqrs.fecha_solicitud)
        if pqrs.fecha_solicitud
        else format_now_fecha_hora_co()
    )
    fecha_venc = format_fecha_co(pqrs.fecha_vencimiento)
    nombre = pqrs.nombre_ciudadano or "Ciudadano/a"

    text_body = (
        f"Estimado/a {nombre},\n\n"
        f"Su {tipo_label} ha sido radicada exitosamente ante {entity_name}.\n\n"
        f"Número de radicado: {pqrs.numero_radicado}\n"
        f"Asunto: {pqrs.asunto}\n"
        f"Fecha de radicación: {fecha_sol}\n"
        f"Fecha límite de respuesta (Ley 1755/2015): {fecha_venc}\n\n"
        f"Conserve este número de radicado para futuras consultas.\n\n"
        f"Atentamente,\n{entity_name}"
    )

    inner = f"""
    <p style="color:#475569;font-size:14px;">Estimado/a <strong>{html.escape(nombre)}</strong>,</p>
    <p style="color:#475569;font-size:14px;">
      Su <strong>{html.escape(tipo_label)}</strong> ha sido radicada exitosamente.
    </p>
    <div style="background:#f1f5f9;border-radius:6px;padding:12px 16px;margin:12px 0;
                font-size:15px;font-weight:bold;color:#1e293b;text-align:center;">
      {html.escape(pqrs.numero_radicado)}
    </div>
    <table style="width:100%;font-size:13px;color:#475569;margin-top:12px;">
      <tr><td style="padding:4px 0;font-weight:600;">Asunto:</td>
          <td>{html.escape(pqrs.asunto)}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Fecha radicación:</td>
          <td>{html.escape(fecha_sol)}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Plazo de respuesta:</td>
          <td>{html.escape(fecha_venc)}</td></tr>
    </table>
    <p style="color:#64748b;font-size:12px;margin-top:16px;">
      Conserve este número de radicado para futuras consultas.
    </p>
    """
    html_body = _wrap_html(entity_name, "Confirmación de radicación PQRS", inner)
    return subject, text_body, html_body


def _firma_respondedor(enviado_por) -> str:
    if not enviado_por:
        return ""
    return (getattr(enviado_por, "email_firma", None) or "").strip()


def _html_firma_block(firma: str) -> str:
    if not firma:
        return ""
    safe = html.escape(firma).replace("\n", "<br>\n")
    return (
        f'<div style="margin-top:12px;color:#202124;font-size:13px;line-height:1.5;">{safe}</div>'
    )


def _texto_con_firma(texto: str, firma: str) -> str:
    if not firma:
        return texto
    return f"{texto.rstrip()}\n\n{firma}"


def _build_respuesta_bodies(
    pqrs: PQRS,
    texto_respuesta: str,
    *,
    enviado_por=None,
) -> tuple[str, str, str]:
    tipo_label = _tipo_label(pqrs)
    subject = f"Respuesta a su {tipo_label} No. {pqrs.numero_radicado}"

    firma = _firma_respondedor(enviado_por)
    text_body = _texto_con_firma(texto_respuesta, firma)
    safe_texto = html.escape(texto_respuesta).replace("\n", "<br>\n")
    html_body = (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;'
        'color:#202124;line-height:1.5;margin:0;padding:0;">'
        f"<div>{safe_texto}</div>"
        f"{_html_firma_block(firma)}"
        "</div>"
    )
    return subject, text_body, html_body


def _destinatarios_inicial(
    emails: list[str],
    *,
    cc_emails: list[str] | None = None,
) -> list[dict[str, Any]]:
    dests = [
        {"email": e, "estado": "pendiente", "motivo": None, "evento_at": None, "rol": "to"}
        for e in emails
    ]
    seen = {d["email"].lower() for d in dests}
    for email in cc_emails or []:
        lower = email.lower()
        if lower in seen:
            continue
        dests.append(
            {"email": email, "estado": "pendiente", "motivo": None, "evento_at": None, "rol": "cc"}
        )
        seen.add(lower)
    return dests


def _crear_registro_correo(
    *,
    pqrs: PQRS,
    tipo: str,
    asunto: str,
    cuerpo_resumen: str,
    destinatarios: list[str],
    enviado_por=None,
    cc_destinatarios: list[str] | None = None,
) -> PQRSCorreo:
    return PQRSCorreo.objects.create(
        pqrs=pqrs,
        tipo=tipo,
        asunto=asunto,
        cuerpo_resumen=cuerpo_resumen[:500],
        destinatarios=_destinatarios_inicial(destinatarios, cc_emails=cc_destinatarios),
        enviado_por=enviado_por,
        estado=EstadoCorreoPQRS.PENDIENTE,
    )


def _actualizar_pqrs_resumen(
    pqrs: PQRS,
    ok: bool,
    error: str | None,
    *,
    actualizar_resumen_ciudadano: bool = True,
) -> None:
    if not actualizar_resumen_ciudadano:
        return
    pqrs.email_enviado = ok
    pqrs.email_error = (error or "")[:500] if not ok else ""
    pqrs.save(update_fields=["email_enviado", "email_error", "updated_at"])


def _destinatarios_secretaria(secretaria) -> list[str]:
    """Correos de secretarios (y admins vinculados) activos de la dependencia."""
    from apps.accounts.models import User
    from apps.common.roles import user_roles

    emails: list[str] = []
    seen: set[str] = set()
    qs = User.objects.filter(
        secretaria=secretaria,
        entity_id=secretaria.entity_id,
        is_active=True,
    ).exclude(email="").order_by("full_name", "email")
    for user in qs:
        roles = user_roles(user)
        if "secretario" not in roles and "admin" not in roles:
            continue
        email = (user.email or "").strip()
        lower = email.lower()
        if email and lower not in seen:
            emails.append(email)
            seen.add(lower)
    return emails


_ESTADOS_ASIGNACION_OK = frozenset(
    {EstadoCorreoPQRS.ENVIADO, EstadoCorreoPQRS.ENTREGADO},
)


def asignacion_notificada_exitosa(pqrs: PQRS, secretaria) -> bool:
    """True si ya hubo un envío exitoso de asignación a esa dependencia."""
    recipients = _destinatarios_secretaria(secretaria)
    if not recipients:
        return False
    destinos_ok = {addr.lower() for addr in recipients}
    for correo in PQRSCorreo.objects.filter(
        pqrs=pqrs,
        tipo=TipoCorreoPQRS.ASIGNACION,
        estado__in=_ESTADOS_ASIGNACION_OK,
    ):
        for item in correo.destinatarios or []:
            email = (item.get("email") or "").strip().lower()
            if email in destinos_ok:
                return True
    return False


def secretarias_pendientes_notificacion_asignacion(
    pqrs: PQRS,
    secretarias: list,
    *,
    current_ids: set[int],
    agregadas: list,
) -> list:
    """Dependencias que deben recibir (o reintentar) correo de asignación."""
    target_ids = {s.id for s in secretarias}
    pendientes: list = []
    seen_ids: set[int] = set()

    for sec in agregadas:
        if sec.id not in seen_ids:
            pendientes.append(sec)
            seen_ids.add(sec.id)

    # Misma asignación pero sin envío previo (p. ej. IA asignó y el correo nunca salió).
    if current_ids == target_ids:
        for sec in secretarias:
            if sec.id in seen_ids:
                continue
            if not asignacion_notificada_exitosa(pqrs, sec):
                pendientes.append(sec)
                seen_ids.add(sec.id)

    return pendientes


def _build_asignacion_bodies(
    pqrs: PQRS,
    secretaria,
    *,
    justificacion: str = "",
    asignado_por=None,
) -> tuple[str, str, str]:
    entity_name = _entity_name(pqrs)
    tipo_label = _tipo_label(pqrs)
    subject = f"PQRS asignada — {pqrs.numero_radicado}"
    fecha_sol = (
        format_fecha_hora_co(pqrs.fecha_solicitud)
        if pqrs.fecha_solicitud
        else format_now_fecha_hora_co()
    )
    fecha_venc = format_fecha_co(pqrs.fecha_vencimiento)
    asignador = ""
    if asignado_por is not None:
        asignador = getattr(asignado_por, "full_name", None) or getattr(asignado_por, "email", "") or ""
    just_txt = (justificacion or pqrs.justificacion_asignacion or "").strip()

    text_body = (
        f"Se le ha asignado una {tipo_label} en {entity_name}.\n\n"
        f"Secretaría: {secretaria.nombre}\n"
        f"Radicado: {pqrs.numero_radicado}\n"
        f"Asunto: {pqrs.asunto}\n"
        f"Fecha de solicitud: {fecha_sol}\n"
        f"Plazo de respuesta (Ley 1755/2015): {fecha_venc}\n"
    )
    if asignador:
        text_body += f"Asignado por: {asignador}\n"
    if just_txt:
        text_body += f"Justificación: {just_txt}\n"
    detail_url = _pqrs_detail_url(pqrs)
    text_body += f"\nVer y gestionar la PQRS: {detail_url}\n"

    inner = f"""
    <p style="color:#475569;font-size:14px;">
      Se le ha asignado una <strong>{html.escape(tipo_label)}</strong> en
      <strong>{html.escape(secretaria.nombre)}</strong>.
    </p>
    <div style="background:#f1f5f9;border-radius:6px;padding:12px 16px;margin:12px 0;
                font-size:15px;font-weight:bold;color:#1e293b;text-align:center;">
      {html.escape(pqrs.numero_radicado)}
    </div>
    <table style="width:100%;font-size:13px;color:#475569;margin-top:12px;">
      <tr><td style="padding:4px 0;font-weight:600;">Asunto:</td>
          <td>{html.escape(pqrs.asunto)}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Fecha solicitud:</td>
          <td>{html.escape(fecha_sol)}</td></tr>
      <tr><td style="padding:4px 0;font-weight:600;">Plazo de respuesta:</td>
          <td>{html.escape(fecha_venc)}</td></tr>
    """
    if asignador:
        inner += f"""
      <tr><td style="padding:4px 0;font-weight:600;">Asignado por:</td>
          <td>{html.escape(asignador)}</td></tr>
        """
    if just_txt:
        inner += f"""
      <tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Justificación:</td>
          <td>{html.escape(just_txt)}</td></tr>
        """
    inner += "</table>"
    inner += _email_cta_button(detail_url, "Ver PQRS asignada")
    inner += f"""
    <p style="color:#64748b;font-size:12px;text-align:center;margin-top:8px;">
      Si el botón no funciona, copie este enlace:<br>
      <a href="{html.escape(detail_url, quote=True)}" style="color:#0e7490;word-break:break-all;">
        {html.escape(detail_url)}
      </a>
    </p>
    """
    html_body = _wrap_html(entity_name, "Notificación de asignación PQRS", inner)
    return subject, text_body, html_body


def enviar_notificacion_asignacion(
    pqrs: PQRS,
    secretaria,
    *,
    asignado_por=None,
    justificacion: str = "",
) -> PQRSCorreo | None:
    """Notifica por correo a los secretarios de la dependencia asignada."""
    recipients = _destinatarios_secretaria(secretaria)
    subject, text_body, html_body = _build_asignacion_bodies(
        pqrs,
        secretaria,
        justificacion=justificacion,
        asignado_por=asignado_por,
    )

    if not recipients:
        sin_dest_msg = (
            f"Sin usuarios secretario/admin activos con email "
            f"en {secretaria.nombre}."
        )
        logger.warning(
            "PQRS %s — %s",
            pqrs.numero_radicado,
            sin_dest_msg,
        )
        registro = PQRSCorreo.objects.create(
            pqrs=pqrs,
            tipo=TipoCorreoPQRS.ASIGNACION,
            asunto=subject,
            cuerpo_resumen=text_body[:500],
            destinatarios=[],
            enviado_por=asignado_por,
            estado=EstadoCorreoPQRS.ERROR,
            error=sin_dest_msg[:500],
        )
        return registro

    registro = _crear_registro_correo(
        pqrs=pqrs,
        tipo=TipoCorreoPQRS.ASIGNACION,
        asunto=subject,
        cuerpo_resumen=text_body,
        destinatarios=recipients,
        enviado_por=asignado_por,
    )

    ok, request_id, error = _post_zeptomail(
        from_name=_from_name(pqrs),
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        reply_to=_reply_to(pqrs),
    )
    if ok:
        registro.estado = EstadoCorreoPQRS.ENVIADO
        registro.request_id = request_id
        for d in registro.destinatarios:
            d["estado"] = "enviado"
    else:
        registro.estado = EstadoCorreoPQRS.ERROR
        registro.error = error
        for d in registro.destinatarios:
            d["estado"] = "error"
            d["motivo"] = error
    registro.save(update_fields=["estado", "request_id", "error", "destinatarios", "updated_at"])
    logger.info(
        "Asignación PQRS %s — correo a %s (%s)",
        pqrs.numero_radicado,
        secretaria.nombre,
        ", ".join(recipients) if ok else f"error: {error}",
    )
    return registro


def enviar_radicacion(pqrs: PQRS) -> PQRSCorreo | None:
    """Envía confirmación de radicación al ciudadano (portal público)."""
    email = (pqrs.email_ciudadano or "").strip()
    if not email:
        return None
    try:
        recipients = parse_email_list(email)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Email inválido en PQRS %s: %s", pqrs.numero_radicado, exc)
        return None

    pqrs = PQRS.objects.prefetch_related("archivos").get(pk=pqrs.pk)
    subject, text_body, html_body = _build_radicacion_bodies(pqrs)
    attachments = _adjuntos_radicacion(pqrs)
    registro = _crear_registro_correo(
        pqrs=pqrs,
        tipo=TipoCorreoPQRS.RADICACION,
        asunto=subject,
        cuerpo_resumen=text_body,
        destinatarios=recipients,
    )

    ok, request_id, error = _post_zeptomail(
        from_name=_from_name(pqrs),
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        reply_to=_reply_to(pqrs),
        attachments=attachments or None,
    )
    if ok:
        registro.estado = EstadoCorreoPQRS.ENVIADO
        registro.request_id = request_id
        for d in registro.destinatarios:
            d["estado"] = "enviado"
    else:
        registro.estado = EstadoCorreoPQRS.ERROR
        registro.error = error
        for d in registro.destinatarios:
            d["estado"] = "error"
            d["motivo"] = error
    registro.save(update_fields=["estado", "request_id", "error", "destinatarios", "updated_at"])
    _actualizar_pqrs_resumen(pqrs, ok, error)
    sync_correo_alerta(pqrs)
    if ok:
        logger.info("Radicación PQRS %s — correo enviado a %s", pqrs.numero_radicado, ", ".join(recipients))
    else:
        logger.warning("Radicación PQRS %s — error correo: %s", pqrs.numero_radicado, error)
    return registro


def enviar_respuesta(
    pqrs: PQRS,
    texto_respuesta: str,
    destinatarios_raw: str,
    *,
    enviado_por=None,
) -> tuple[PQRSCorreo, bool, str | None]:
    """Envía respuesta PQRS a uno o varios destinatarios."""
    recipients = parse_email_list(destinatarios_raw)
    if not recipients:
        raise ValueError("No hay destinatarios válidos.")
    cc = _cc_respondedor(enviado_por)

    subject, text_body, html_body = _build_respuesta_bodies(
        pqrs, texto_respuesta, enviado_por=enviado_por
    )
    registro = _crear_registro_correo(
        pqrs=pqrs,
        tipo=TipoCorreoPQRS.RESPUESTA,
        asunto=subject,
        cuerpo_resumen=text_body,
        destinatarios=recipients,
        enviado_por=enviado_por,
        cc_destinatarios=cc,
    )

    attachments = _adjuntos_respuesta(pqrs)
    ok, request_id, error = _post_zeptomail(
        from_name=_from_name(pqrs, include_secretaria=True),
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        reply_to=_reply_to(pqrs),
        attachments=attachments or None,
        cc=cc,
    )
    if ok:
        registro.estado = EstadoCorreoPQRS.ENVIADO
        registro.request_id = request_id
        for d in registro.destinatarios:
            d["estado"] = "enviado"
    else:
        registro.estado = EstadoCorreoPQRS.ERROR
        registro.error = error
        for d in registro.destinatarios:
            d["estado"] = "error"
            d["motivo"] = error
    registro.save(update_fields=["estado", "request_id", "error", "destinatarios", "updated_at"])
    _actualizar_pqrs_resumen(pqrs, ok, error)
    sync_correo_alerta(pqrs)
    return registro, ok, error


def reenviar_correo(
    correo: PQRSCorreo,
    destinatarios_raw: str | None = None,
) -> tuple[PQRSCorreo, bool, str | None]:
    """Reenvía solo a destinatarios con fallo (o los corregidos explícitamente)."""
    pqrs = correo.pqrs
    if destinatarios_raw:
        recipients = parse_email_list(destinatarios_raw)
    else:
        recipients = failed_recipients_from_correo(correo)
    if not recipients:
        raise ValueError("No hay destinatarios con error para reenviar.")

    if correo.tipo == TipoCorreoPQRS.RADICACION:
        subject, text_body, html_body = _build_radicacion_bodies(pqrs)
        from_name = _from_name(pqrs)
    else:
        texto = pqrs.respuesta or correo.cuerpo_resumen or ""
        subject, text_body, html_body = _build_respuesta_bodies(
            pqrs, texto, enviado_por=correo.enviado_por
        )
        from_name = _from_name(pqrs, include_secretaria=True)

    if correo.tipo == TipoCorreoPQRS.RADICACION:
        cc: list[str] = []
    else:
        cc = _cc_respondedor(correo.enviado_por)

    nuevo = _crear_registro_correo(
        pqrs=pqrs,
        tipo=correo.tipo,
        asunto=subject,
        cuerpo_resumen=text_body,
        destinatarios=recipients,
        enviado_por=correo.enviado_por,
        cc_destinatarios=cc,
    )

    if correo.tipo == TipoCorreoPQRS.RADICACION:
        pqrs = PQRS.objects.prefetch_related("archivos").get(pk=pqrs.pk)
        attachments = _adjuntos_radicacion(pqrs)
    else:
        attachments = _adjuntos_respuesta(pqrs)

    ok, request_id, error = _post_zeptomail(
        from_name=from_name,
        recipients=recipients,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        reply_to=_reply_to(pqrs),
        attachments=attachments or None,
        cc=cc,
    )
    if ok:
        nuevo.estado = EstadoCorreoPQRS.ENVIADO
        nuevo.request_id = request_id
        for d in nuevo.destinatarios:
            d["estado"] = "enviado"
    else:
        nuevo.estado = EstadoCorreoPQRS.ERROR
        nuevo.error = error
        for d in nuevo.destinatarios:
            d["estado"] = "error"
            d["motivo"] = error
    nuevo.save(update_fields=["estado", "request_id", "error", "destinatarios", "updated_at"])
    if ok and destinatarios_raw:
        marcar_destinatarios_sustituidos(pqrs, correo, recipients)
    _actualizar_pqrs_resumen(pqrs, ok, error)
    sync_correo_alerta(pqrs)
    return nuevo, ok, error
