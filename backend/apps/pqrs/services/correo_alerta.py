"""Sincronización de alertas de correo PQRS."""
from __future__ import annotations

from apps.pqrs.models import PQRS, PQRSCorreo

ESTADOS_ALERTA_DEST = frozenset({
    "error",
    "rebotado",
    "rebote_temporal",
    "reclamacion_spam",
})

ESTADOS_RESUELTOS = frozenset({
    "enviado",
    "entregado",
    "sustituido",
    "descartado",
})


def latest_estado_por_email(pqrs_id: int) -> dict[str, str]:
    """Último estado conocido por destinatario (cronológico)."""
    latest: dict[str, str] = {}
    correos = PQRSCorreo.objects.filter(pqrs_id=pqrs_id).order_by("created_at", "id")
    for correo in correos:
        for d in correo.destinatarios or []:
            email = (d.get("email") or "").strip().lower()
            estado = d.get("estado")
            if email and estado:
                latest[email] = estado
    return latest


def compute_correo_alerta(pqrs_id: int) -> bool:
    """True solo si el último estado por destinatario sigue en fallo."""
    latest = latest_estado_por_email(pqrs_id)
    return any(est in ESTADOS_ALERTA_DEST for est in latest.values())


def sync_correo_alerta(pqrs: PQRS) -> bool:
    flag = compute_correo_alerta(pqrs.id)
    if pqrs.correo_alerta != flag:
        pqrs.correo_alerta = flag
        pqrs.save(update_fields=["correo_alerta", "updated_at"])
    return flag


def failed_recipients_from_correo(correo: PQRSCorreo) -> list[str]:
    emails: list[str] = []
    seen: set[str] = set()
    for d in correo.destinatarios or []:
        email = (d.get("email") or "").strip()
        estado = d.get("estado") or ""
        if not email or estado not in ESTADOS_ALERTA_DEST:
            continue
        lower = email.lower()
        if lower in seen:
            continue
        emails.append(email)
        seen.add(lower)
    return emails


def _emails_en_alerta(pqrs_id: int) -> list[str]:
    latest = latest_estado_por_email(pqrs_id)
    casing: dict[str, str] = {}
    for correo in PQRSCorreo.objects.filter(pqrs_id=pqrs_id).order_by("created_at", "id"):
        for d in correo.destinatarios or []:
            email = (d.get("email") or "").strip()
            if email:
                casing[email.lower()] = email
    return [casing[key] for key, estado in latest.items() if estado in ESTADOS_ALERTA_DEST and key in casing]


def marcar_emails_estado(
    pqrs_id: int,
    emails_lower: set[str],
    nuevo_estado: str,
    motivo: str,
) -> None:
    """Actualiza destinatarios en alerta para dejar de contarlos como fallo activo."""
    for correo in PQRSCorreo.objects.filter(pqrs_id=pqrs_id):
        destinatarios = list(correo.destinatarios or [])
        changed = False
        for d in destinatarios:
            email = (d.get("email") or "").strip().lower()
            if email in emails_lower and d.get("estado") in ESTADOS_ALERTA_DEST:
                d["estado"] = nuevo_estado
                d["motivo"] = motivo
                changed = True
        if changed:
            correo.destinatarios = destinatarios
            correo.save(update_fields=["destinatarios", "updated_at"])


def marcar_destinatarios_sustituidos(
    pqrs: PQRS,
    correo: PQRSCorreo,
    corrected_recipients: list[str],
) -> None:
    """Marca fallos reemplazados al reenviar a un correo distinto."""
    failed = failed_recipients_from_correo(correo)
    corrected_lower = {email.lower() for email in corrected_recipients}
    sustituidos = {failed_email.lower() for failed_email in failed if failed_email.lower() not in corrected_lower}
    if not sustituidos:
        return
    marcar_emails_estado(
        pqrs.id,
        sustituidos,
        "sustituido",
        "Destinatario corregido; la notificación se reenvió a otro correo.",
    )


def descartar_alerta_correo(pqrs: PQRS) -> PQRS:
    """Descarta destinatarios con error cuando no se puede o no se desea reenviar."""
    from apps.pqrs.services.email import parse_email_list

    emails = _emails_en_alerta(pqrs.id)
    if not emails:
        sync_correo_alerta(pqrs)
        return pqrs

    emails_lower = {email.lower() for email in emails}
    marcar_emails_estado(
        pqrs.id,
        emails_lower,
        "descartado",
        "Destinatario descartado: no se reenviará notificación a este correo.",
    )

    try:
        existing = parse_email_list(pqrs.email_ciudadano or "")
    except ValueError:
        existing = []
    remaining = [email for email in existing if email.lower() not in emails_lower]
    pqrs.email_ciudadano = ", ".join(remaining)
    pqrs.save(update_fields=["email_ciudadano", "updated_at"])
    sync_correo_alerta(pqrs)
    return pqrs
