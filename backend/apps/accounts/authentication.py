"""Clerk session token authentication mapped to local Django users."""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.accounts.services.clerk import (
    ClerkServiceError,
    get_primary_email_for_clerk_id,
)

logger = logging.getLogger(__name__)
User = get_user_model()


class ClerkAuthentication(BaseAuthentication):
    """Verify Clerk session JWT and resolve to local User (roles, entity, modules)."""

    def authenticate(self, request):
        secret = settings.CLERK_SECRET_KEY
        if not secret:
            return None

        django_request = getattr(request, "_request", request)
        options = AuthenticateRequestOptions(
            secret_key=secret,
            authorized_parties=settings.CLERK_AUTHORIZED_PARTIES or None,
            jwt_key=settings.CLERK_JWT_KEY or None,
        )
        sdk = Clerk(bearer_auth=secret)
        state = sdk.authenticate_request(django_request, options)

        if not state.is_signed_in:
            return None

        payload = state.payload or {}
        clerk_id = payload.get("sub")
        if not clerk_id:
            raise AuthenticationFailed("Token Clerk sin identificador de usuario.")

        user = self._resolve_user(clerk_id)
        self._validate_user(user)
        return (user, payload)

    def _resolve_user(self, clerk_id: str) -> User:
        user = (
            User.objects.select_related("entity")
            .prefetch_related("groups")
            .filter(clerk_id=clerk_id)
            .first()
        )
        if user:
            return user

        try:
            email = get_primary_email_for_clerk_id(clerk_id)
        except ClerkServiceError as exc:
            logger.warning("Clerk lookup failed for %s: %s", clerk_id, exc)
            raise AuthenticationFailed("No se pudo verificar el usuario en Clerk.") from exc

        if not email:
            raise AuthenticationFailed(
                "Usuario de Clerk sin email. Contacta al administrador.",
                code="clerk_no_email",
            )

        user = (
            User.objects.select_related("entity")
            .prefetch_related("groups")
            .filter(email__iexact=email)
            .first()
        )
        if not user:
            raise AuthenticationFailed(
                "Tu cuenta no está registrada en SoftOne. Contacta al administrador.",
                code="user_not_provisioned",
            )

        user.clerk_id = clerk_id
        user.save(update_fields=["clerk_id"])
        return user

    def _validate_user(self, user: User) -> None:
        if not user.is_active:
            raise AuthenticationFailed(
                "Tu cuenta está inhabilitada. Contacta al administrador.",
                code="user_inactive",
            )
        if user.entity_id and user.entity and not user.entity.is_active:
            raise AuthenticationFailed(
                "La entidad a la que perteneces está inactiva. Contacta al administrador.",
                code="entity_inactive",
            )
