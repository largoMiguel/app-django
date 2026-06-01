"""Consulta de proyectos BPIN en datos.gov.co."""
from __future__ import annotations

import json
import logging
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

import certifi
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

DATOS_GOV_CO_API = "https://www.datos.gov.co/resource/cf9k-55fw.json"
DATOS_GOV_CO_PORTAL = "https://www.datos.gov.co/Inversi-n/Proyectos-de-Inversi-n-P-blica-BPIN/cf9k-55fw"


def _build_consulta_url(bpin: str, strategy: str = "direct") -> str:
    if strategy == "where":
        where = f'caseless_one_of(`bpin`, "{bpin}")'
        return f"{DATOS_GOV_CO_API}?$where={urllib.parse.quote(where)}&$limit=1"
    return f"{DATOS_GOV_CO_API}?bpin={urllib.parse.quote(bpin)}&$limit=1"


def _fetch_json(url: str) -> list[dict[str, Any]]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "SoftOne360-PDM/1.0",
            "Accept": "application/json",
        },
        method="GET",
    )
    context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(request, timeout=30, context=context) as response:
        payload = response.read().decode("utf-8")
        data = json.loads(payload)
        return data if isinstance(data, list) else []


def consultar_bpin_externo(bpin: str) -> tuple[dict[str, Any] | None, str, str | None]:
    bpin = (bpin or "").strip()
    if not bpin:
        return None, "", "Código BPIN requerido."

    cache_key = f"bpin:{bpin}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, _build_consulta_url(bpin), None

    urls = [_build_consulta_url(bpin, "direct"), _build_consulta_url(bpin, "where")]
    last_error: str | None = None

    for url in urls:
        try:
            data = _fetch_json(url)
            if data:
                result = data[0]
                cache.set(cache_key, result, 7200)
                logger.info("BPIN encontrado %s", bpin)
                return result, url, None
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}: {exc.reason}"
            logger.warning("BPIN HTTP error %s: %s", bpin, last_error)
        except urllib.error.URLError as exc:
            last_error = str(exc.reason or exc)
            logger.warning("BPIN URL error %s: %s", bpin, last_error)
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            logger.warning("BPIN fetch error %s: %s", bpin, last_error)

    return None, urls[0], last_error or "No se encontró información para este BPIN."


class BpinDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, bpin: str):
        proyecto, consulta_url, error = consultar_bpin_externo(bpin)
        payload = {
            "proyecto": proyecto,
            "consulta_url": consulta_url or _build_consulta_url((bpin or "").strip()),
            "portal_url": DATOS_GOV_CO_PORTAL,
            "detail": None if proyecto else (error or "No se encontró información para este código BPIN."),
        }
        if error and not proyecto and any(x in error.upper() for x in ("CERTIFICATE", "HTTP", "TIMED OUT")):
            return Response({**payload, "detail": f"Error al consultar datos.gov.co: {error}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(payload)
