"""Custom JWT authentication that validates entity and user status on every request."""
from __future__ import annotations

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class SoftOneJWTAuthentication(JWTAuthentication):
    """Extends JWTAuthentication to block access when:
    - The user is inactive (is_active=False)
    - The user's entity is inactive (entity.is_active=False)
    """

    def get_user(self, validated_token):
        from django.contrib.auth import get_user_model

        User = get_user_model()

        try:
            user_id = validated_token["user_id"]
        except KeyError:
            raise AuthenticationFailed("Token sin user_id.", code="token_not_valid")

        try:
            user = User.objects.select_related("entity").get(pk=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed("Usuario no encontrado.", code="user_not_found")

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

        return user
