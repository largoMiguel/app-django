"""Vistas compartidas."""
from __future__ import annotations

import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseForbidden
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from botocore.exceptions import ClientError

from apps.common.b2_client import get_b2_client
from apps.common.file_delivery import verify_signed_file_url
from apps.pdm.access import user_can_access_pdm_media_path
from apps.pqrs.access import user_can_access_media_path as user_can_access_pqrs_media_path


class SignedFileDeliveryView(APIView):
    """Entrega archivos B2 con URL firmada (files.softone360.com o fallback vía túnel)."""

    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request, bucket: str, path: str):
        allowed = {
            settings.B2_BUCKET_PQRS,
            settings.B2_BUCKET_PDM,
            settings.B2_BUCKET_ASISTENCIA,
        }
        if bucket not in allowed:
            return HttpResponseForbidden("Forbidden")

        exp = request.query_params.get("exp")
        sig = request.query_params.get("sig")
        if not verify_signed_file_url(bucket, path, exp, sig):
            return HttpResponseForbidden("Forbidden")

        client = get_b2_client()
        key = path.lstrip("/")
        try:
            obj = client.get_object(Bucket=bucket, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in {"NoSuchKey", "404", "NotFound"}:
                raise Http404("Archivo no encontrado.") from exc
            raise Http404("Archivo no encontrado.") from exc

        body = obj["Body"].read()
        content_type = obj.get("ContentType") or mimetypes.guess_type(path)[0] or "application/octet-stream"
        response = HttpResponse(body, content_type=content_type)
        download_name = request.query_params.get("dl")
        if download_name:
            safe = download_name.replace('"', "_")
            response["Content-Disposition"] = f'inline; filename="{safe}"'
        response["Cache-Control"] = "private, max-age=300"
        return response


class ProtectedMediaView(APIView):
    """Sirve archivos media sólo a usuarios autorizados sobre la PQRS."""

    permission_classes = (IsAuthenticated,)

    def get(self, request, path: str):
        if not user_can_access_pqrs_media_path(request.user, path) and not user_can_access_pdm_media_path(
            request.user, path
        ):
            raise Http404("Archivo no encontrado.")

        media_root = Path(settings.MEDIA_ROOT).resolve()
        full_path = (media_root / path).resolve()
        if not str(full_path).startswith(str(media_root)) or not full_path.is_file():
            raise Http404("Archivo no encontrado.")

        from django.http import FileResponse

        return FileResponse(open(full_path, "rb"), as_attachment=False)
