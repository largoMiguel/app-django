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


def _normalize_proyecto_bpin(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "bpin": row.get("bpin", ""),
        "nombreproyecto": row.get("nombreproyecto"),
        "estadoproyecto": row.get("estadoproyecto"),
        "sector": row.get("sector"),
        "objetivogeneral": row.get("objetivogeneral"),
        "horizonte": row.get("horizonte"),
        "entidadresponsable": row.get("entidadresponsable"),
        "valortotalproyecto": row.get("valortotalproyecto"),
        "valorvigenteproyecto": row.get("valorvigenteproyecto"),
    }


def _build_batch_consulta_url(bpines: list[str]) -> str:
    quoted = ", ".join(f'"{b}"' for b in bpines)
    where = f"caseless_one_of(`bpin`, {quoted})"
    return f"{DATOS_GOV_CO_API}?$where={urllib.parse.quote(where)}&$limit={len(bpines)}"


def consultar_bpines_externos(bpines: list[str]) -> tuple[dict[str, dict[str, Any]], str | None]:
    """Consulta varios BPIN en datos.gov.co (caché + lote)."""
    unique = []
    seen: set[str] = set()
    for raw in bpines:
        bpin = (raw or "").strip()
        if bpin and bpin not in seen:
            seen.add(bpin)
            unique.append(bpin)

    if not unique:
        return {}, None

    result: dict[str, dict[str, Any]] = {}
    pending: list[str] = []

    for bpin in unique:
        cache_key = f"bpin:{bpin}"
        cached = cache.get(cache_key)
        if cached is not None:
            result[bpin] = _normalize_proyecto_bpin(cached)
        else:
            pending.append(bpin)

    if not pending:
        return result, None

    batch_size = 50
    last_error: str | None = None

    for i in range(0, len(pending), batch_size):
        batch = pending[i : i + batch_size]
        url = _build_batch_consulta_url(batch)
        try:
            rows = _fetch_json(url)
            found: set[str] = set()
            for row in rows:
                bpin = str(row.get("bpin", "")).strip()
                if not bpin:
                    continue
                normalized = _normalize_proyecto_bpin(row)
                result[bpin] = normalized
                found.add(bpin)
                cache.set(f"bpin:{bpin}", row, 7200)
            for bpin in batch:
                if bpin not in found and bpin not in result:
                    cache.set(f"bpin:{bpin}", {}, 7200)
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}: {exc.reason}"
            logger.warning("BPIN batch HTTP error: %s", last_error)
        except urllib.error.URLError as exc:
            last_error = str(exc.reason or exc)
            logger.warning("BPIN batch URL error: %s", last_error)
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            logger.warning("BPIN batch fetch error: %s", last_error)

    return result, last_error


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
