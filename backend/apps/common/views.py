"""Vistas compartidas."""
from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.pqrs.access import user_can_access_media_path


class ProtectedMediaView(APIView):
    """Sirve archivos media sólo a usuarios autorizados sobre la PQRS."""

    permission_classes = (IsAuthenticated,)

    def get(self, request, path: str):
        if not user_can_access_media_path(request.user, path):
            raise Http404("Archivo no encontrado.")

        media_root = Path(settings.MEDIA_ROOT).resolve()
        full_path = (media_root / path).resolve()
        if not str(full_path).startswith(str(media_root)) or not full_path.is_file():
            raise Http404("Archivo no encontrado.")

        return FileResponse(open(full_path, "rb"), as_attachment=False)
