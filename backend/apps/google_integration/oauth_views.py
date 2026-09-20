"""OAuth gmail.send — conexión por funcionario."""
from __future__ import annotations

import secrets
import urllib.parse
from datetime import timedelta

from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.google_integration.crypto import encrypt_refresh_token
from apps.google_integration.gmail_client import exchange_oauth_code
from apps.google_integration.models import GoogleConnectionStatus, GoogleEmailConnection, GoogleOAuthState

GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email"


class GoogleConnectView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if not getattr(settings, "GOOGLE_GMAIL_SEND_ENABLED", False):
            return Response({"detail": "Integración Gmail deshabilitada."}, status=503)
        client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
        redirect_uri = (settings.GOOGLE_REDIRECT_URI or "").strip()
        if not client_id or not redirect_uri:
            return Response({"detail": "Google OAuth no configurado."}, status=503)

        state = secrets.token_urlsafe(32)
        entity_id = getattr(request.user, "_active_entity_id", None) or request.user.entity_id
        GoogleOAuthState.objects.create(
            state=state,
            user=request.user,
            entity_id=entity_id,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": f"{GMAIL_SEND_SCOPE} {USERINFO_SCOPE}",
            "access_type": "offline",
            "include_granted_scopes": "true",
            "state": state,
        }
        existing = GoogleEmailConnection.objects.filter(user=request.user).first()
        if not existing or existing.status == GoogleConnectionStatus.REQUIERE_REAUTORIZACION:
            params["prompt"] = "consent"
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
        return Response({"authorize_url": url})


class GoogleCallbackView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request):
        # Callback es navegación del navegador; el frontend abre authorize_url y Google redirige aquí.
        # Validamos state sin confiar en query user_id.
        code = (request.query_params.get("code") or "").strip()
        state = (request.query_params.get("state") or "").strip()
        error = request.query_params.get("error")
        frontend = (getattr(settings, "APP_PUBLIC_URL", "") or "https://app.softone360.com").rstrip("/")
        if error:
            return HttpResponseRedirect(f"{frontend}/configuracion/correo?error={urllib.parse.quote(error)}")
        if not code or not state:
            return HttpResponseRedirect(f"{frontend}/configuracion/correo?error=missing_code")

        oauth_state = GoogleOAuthState.objects.filter(state=state, used_at__isnull=True).first()
        if not oauth_state or oauth_state.expires_at < timezone.now():
            return HttpResponseRedirect(f"{frontend}/configuracion/correo?error=invalid_state")

        redirect_uri = (settings.GOOGLE_REDIRECT_URI or "").strip()
        try:
            token_data = exchange_oauth_code(code, redirect_uri)
        except Exception:
            return HttpResponseRedirect(f"{frontend}/configuracion/correo?error=token_exchange")

        refresh = token_data.get("refresh_token")
        access = token_data.get("access_token")
        if not refresh and not access:
            return HttpResponseRedirect(f"{frontend}/configuracion/correo?error=no_refresh")

        id_jwt = token_data.get("id_token")
        google_email = ""
        google_sub = ""
        if id_jwt:
            try:
                claims = google_id_token.verify_oauth2_token(
                    id_jwt,
                    google_requests.Request(),
                    settings.GOOGLE_CLIENT_ID,
                )
                google_email = (claims.get("email") or "").lower()
                google_sub = claims.get("sub") or ""
            except Exception:
                pass
        if not google_email:
            return HttpResponseRedirect(f"{frontend}/configuracion/correo?error=no_email")

        user = oauth_state.user
        entity_id = oauth_state.entity_id or user.entity_id
        if not refresh:
            conn = GoogleEmailConnection.objects.filter(user=user).first()
            if not conn:
                return HttpResponseRedirect(
                    f"{frontend}/configuracion/correo?error=need_consent"
                )
            encrypted = conn.encrypted_refresh_token
        else:
            encrypted = encrypt_refresh_token(refresh)

        from apps.entities.models import Entity

        entity = Entity.objects.filter(pk=entity_id).first() if entity_id else user.entity
        GoogleEmailConnection.objects.update_or_create(
            user=user,
            defaults={
                "entity": entity,
                "google_email": google_email,
                "google_subject_id": google_sub,
                "encrypted_refresh_token": encrypted,
                "scopes": [GMAIL_SEND_SCOPE, USERINFO_SCOPE],
                "status": GoogleConnectionStatus.ACTIVA,
                "connected_at": timezone.now(),
                "revoked_at": None,
            },
        )
        oauth_state.used_at = timezone.now()
        oauth_state.save(update_fields=["used_at"])
        return HttpResponseRedirect(f"{frontend}/configuracion/correo?connected=1")


class GoogleStatusView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        conn = GoogleEmailConnection.objects.filter(user=request.user).first()
        if not conn or conn.status == GoogleConnectionStatus.REVOCADA:
            return Response({"connected": False})
        return Response(
            {
                "connected": conn.status == GoogleConnectionStatus.ACTIVA,
                "google_email": conn.google_email,
                "status": conn.status,
                "requires_reauthorization": conn.status
                == GoogleConnectionStatus.REQUIERE_REAUTORIZACION,
            }
        )


class GoogleDisconnectView(APIView):
    permission_classes = (IsAuthenticated,)

    def delete(self, request):
        conn = GoogleEmailConnection.objects.filter(user=request.user).first()
        if conn:
            conn.status = GoogleConnectionStatus.REVOCADA
            conn.revoked_at = timezone.now()
            conn.encrypted_refresh_token = b""
            conn.save(update_fields=["status", "revoked_at", "encrypted_refresh_token", "updated_at"])
        return Response({"connected": False})
