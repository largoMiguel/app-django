"""Descarga de adjuntos Gmail con tokens temporales del Add-on."""
from __future__ import annotations

import logging
from typing import Any

from apps.google_integration.gmail_client import fetch_attachment
from apps.pqrs.validators import validate_inbound_attachment
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def list_attachment_parts(payload: dict[str, Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []

    def walk(part: dict[str, Any]) -> None:
        body = part.get("body") or {}
        filename = (part.get("filename") or "").strip()
        attachment_id = (body.get("attachmentId") or "").strip()
        mime = (part.get("mimeType") or "").strip()
        if attachment_id and filename:
            out.append(
                {
                    "filename": filename,
                    "attachment_id": attachment_id,
                    "mime_type": mime,
                }
            )
        for child in part.get("parts") or []:
            walk(child)

    walk(payload)
    return out


def download_attachments(
    access_token: str,
    message_id: str,
    payload: dict[str, Any],
) -> tuple[list[tuple[str, bytes]], dict[str, str], list[str]]:
    """Retorna (archivos, content_types, warnings)."""
    files: list[tuple[str, bytes]] = []
    ctypes: dict[str, str] = {}
    warnings: list[str] = []
    for item in list_attachment_parts(payload):
        fname = item["filename"]
        try:
            content = fetch_attachment(access_token, message_id, item["attachment_id"])
            validate_inbound_attachment(fname, len(content))
            files.append((fname, content))
            if item.get("mime_type"):
                ctypes[fname] = item["mime_type"]
        except ValidationError:
            warnings.append(f"Adjunto omitido (tamaño o nombre): {fname}")
        except Exception as exc:  # noqa: BLE001
            logger.warning("No se pudo descargar adjunto %s: %s", fname, exc)
            warnings.append(
                f"No se pudo leer el adjunto «{fname}» con el acceso temporal del complemento. "
                "Radique sin ese archivo o reenvíe por IMAP si es indispensable."
            )
    return files, ctypes, warnings
