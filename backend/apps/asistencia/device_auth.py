"""Autenticación de dispositivos kiosk."""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from apps.common.modules import entity_has_module

from .models import EquipoRegistro


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_pairing_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_device_token() -> str:
    return secrets.token_urlsafe(48)


@dataclass
class DeviceContext:
    equipo: EquipoRegistro


class DeviceTokenAuthentication(BaseAuthentication):
    """Bearer token para endpoints públicos del kiosk."""

    keyword = "Bearer"

    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith(f"{self.keyword} "):
            return None
        raw = auth[len(self.keyword) + 1 :].strip()
        if not raw:
            raise AuthenticationFailed("Token de dispositivo inválido.")
        token_hash = hash_token(raw)
        equipo = (
            EquipoRegistro.objects.select_related("entity")
            .filter(device_token_hash=token_hash, is_active=True)
            .first()
        )
        if equipo is None:
            raise AuthenticationFailed("Equipo no autorizado.")
        entity = equipo.entity
        if not entity.is_active or not entity_has_module(entity, "asistencia"):
            raise PermissionDenied("El módulo de asistencia no está activo para esta entidad.")
        EquipoRegistro.objects.filter(pk=equipo.pk).update(last_seen_at=timezone.now())
        request.device_token_raw = raw
        request.equipo = equipo
        return (None, equipo)

    def authenticate_header(self, request):
        return self.keyword


class DeviceTokenAuthenticationRequired(DeviceTokenAuthentication):
    """Exige token de dispositivo en cada request."""

    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith(f"{self.keyword} "):
            raise AuthenticationFailed("Se requiere token de dispositivo.")
        return super().authenticate(request)


def get_equipo_from_request(request) -> EquipoRegistro:
    equipo = getattr(request, "equipo", None)
    if equipo is None:
        raise AuthenticationFailed("Se requiere token de dispositivo.")
    return equipo
