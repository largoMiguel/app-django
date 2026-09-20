"""Mapeo de errores Gmail/OAuth a mensajes en español."""
from __future__ import annotations


class GmailIntegrationError(Exception):
    def __init__(self, message: str, *, code: str = "error", retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


def map_http_error(status: int, body: str = "") -> GmailIntegrationError:
    body_lower = (body or "").lower()
    if status == 401 or "invalid_grant" in body_lower:
        return GmailIntegrationError(
            "La autorización de Gmail expiró. Vuelva a conectar su correo institucional.",
            code="requiere_reautorizacion",
        )
    if status == 403:
        return GmailIntegrationError(
            "Gmail rechazó la operación (permisos insuficientes).",
            code="forbidden",
        )
    if status == 429:
        return GmailIntegrationError(
            "Gmail limitó temporalmente las solicitudes. Intente en unos minutos.",
            code="rate_limit",
            retryable=True,
        )
    if status >= 500:
        return GmailIntegrationError(
            "Gmail no está disponible temporalmente.",
            code="upstream",
            retryable=True,
        )
    return GmailIntegrationError(f"Error de Gmail (HTTP {status}).", code="http_error")
