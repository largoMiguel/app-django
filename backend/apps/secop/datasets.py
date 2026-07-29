"""Cliente SoQL para datasets SECOP en datos.gov.co."""
from __future__ import annotations

import json
import logging
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

import certifi
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

DATOS_GOV_SECOP2_CONTRATOS = "https://www.datos.gov.co/resource/jbjy-vk9h.json"
DATOS_GOV_SECOP2_PROCESOS = "https://www.datos.gov.co/resource/p6dx-8zbt.json"
DATOS_GOV_SECOP1 = "https://www.datos.gov.co/resource/f789-7hwg.json"

PAGE_SIZE = 1000
MAX_ROWS_PER_YEAR = 15000
CACHE_TTL = int(getattr(settings, "SECOP_CACHE_TTL", 21600))

NOTICE_UID_RE = re.compile(r"noticeUID=([^&]+)")


def cache_ttl() -> int:
    return CACHE_TTL


def extract_notice_uid(url_obj: Any) -> str | None:
    if isinstance(url_obj, dict):
        url = url_obj.get("url") or ""
    else:
        url = str(url_obj or "")
    match = NOTICE_UID_RE.search(url)
    return match.group(1) if match else None


def _fetch_json(url: str, timeout: int = 60) -> list[dict[str, Any]]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "SoftOne360-SECOP/1.0",
            "Accept": "application/json",
        },
        method="GET",
    )
    context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        payload = response.read().decode("utf-8")
        data = json.loads(payload)
        return data if isinstance(data, list) else []


def _build_url(base: str, params: dict[str, str]) -> str:
    return f"{base}?{urllib.parse.urlencode(params)}"


def _nit_where(field: str, nits: list[str]) -> str:
    if len(nits) == 1:
        return f"{field}='{nits[0]}'"
    quoted = ", ".join(f"'{n}'" for n in nits)
    return f"{field} in ({quoted})"


def _dedupe_rows(rows: list[dict[str, Any]], key_field: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        key = str(row.get(key_field) or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def _fetch_paginated(
    base: str,
    where: str,
    *,
    order: str,
    cache_key: str,
) -> tuple[list[dict[str, Any]], str | None]:
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, None

    rows: list[dict[str, Any]] = []
    offset = 0
    last_error: str | None = None

    while offset < MAX_ROWS_PER_YEAR:
        params = {
            "$where": where,
            "$limit": str(PAGE_SIZE),
            "$offset": str(offset),
            "$order": order,
        }
        url = _build_url(base, params)
        try:
            batch = _fetch_json(url)
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}: {exc.reason}"
            logger.warning("SECOP fetch HTTP error: %s", last_error)
            break
        except urllib.error.URLError as exc:
            last_error = str(exc.reason or exc)
            logger.warning("SECOP fetch URL error: %s", last_error)
            break
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            logger.warning("SECOP fetch error: %s", last_error)
            break

        if not batch:
            break
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    cache.set(cache_key, rows, CACHE_TTL)
    return rows, last_error


def fetch_secop1_contracts(nits: list[str], anio: int) -> tuple[list[dict[str, Any]], str | None]:
    if not nits:
        return [], "NIT SECOP I no configurado."
    nit_part = _nit_where("nit_de_la_entidad", nits)
    where = f"{nit_part} AND anno_firma_contrato='{anio}'"
    cache_key = f"secop:v1:secop1:{','.join(nits)}:{anio}"
    rows, err = _fetch_paginated(DATOS_GOV_SECOP1, where, order="uid", cache_key=cache_key)
    return _dedupe_rows(rows, "uid"), err


def fetch_secop2_contracts(nits: list[str], anio: int) -> tuple[list[dict[str, Any]], str | None]:
    if not nits:
        return [], "NIT SECOP II no configurado."
    nit_part = _nit_where("nit_entidad", nits)
    where = f"{nit_part} AND date_extract_y(fecha_de_firma)={anio}"
    cache_key = f"secop:v1:secop2c:{','.join(nits)}:{anio}"
    rows, err = _fetch_paginated(
        DATOS_GOV_SECOP2_CONTRATOS,
        where,
        order="id_contrato",
        cache_key=cache_key,
    )
    return _dedupe_rows(rows, "id_contrato"), err


def fetch_secop2_processes(nits: list[str], anio: int) -> tuple[list[dict[str, Any]], str | None]:
    if not nits:
        return [], "NIT SECOP II no configurado."
    nit_part = _nit_where("nit_entidad", nits)
    where = f"{nit_part} AND date_extract_y(fecha_de_publicacion_del)={anio}"
    cache_key = f"secop:v1:secop2p:{','.join(nits)}:{anio}"
    rows, err = _fetch_paginated(
        DATOS_GOV_SECOP2_PROCESOS,
        where,
        order="id_del_proceso",
        cache_key=cache_key,
    )
    return _dedupe_rows(rows, "id_del_proceso"), err


def fetch_secop2_processes_by_portfolios(
    nits: list[str],
    portfolio_ids: list[str],
) -> tuple[list[dict[str, Any]], str | None]:
    """Consulta puntual de procesos por id_del_portafolio (enlace con contratos)."""
    if not nits or not portfolio_ids:
        return [], None
    unique = []
    seen: set[str] = set()
    for pid in portfolio_ids:
        pid = (pid or "").strip()
        if pid and pid not in seen:
            seen.add(pid)
            unique.append(pid)
    if not unique:
        return [], None

    nit_part = _nit_where("nit_entidad", nits)
    rows: list[dict[str, Any]] = []
    last_error: str | None = None
    batch_size = 40
    for i in range(0, len(unique), batch_size):
        chunk = unique[i : i + batch_size]
        quoted = ", ".join(f"'{p}'" for p in chunk)
        where = f"{nit_part} AND id_del_portafolio in ({quoted})"
        params = {"$where": where, "$limit": str(len(chunk) * 2)}
        url = _build_url(DATOS_GOV_SECOP2_PROCESOS, params)
        try:
            rows.extend(_fetch_json(url))
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            logger.warning("SECOP portfolio fetch error: %s", last_error)
    return _dedupe_rows(rows, "id_del_proceso"), last_error


def fetch_available_years_secop1(nits: list[str]) -> tuple[list[dict[str, Any]], str | None]:
    if not nits:
        return [], None
    nit_part = _nit_where("nit_de_la_entidad", nits)
    params = {
        "$select": "anno_firma_contrato, count(1) as total",
        "$where": nit_part,
        "$group": "anno_firma_contrato",
        "$order": "anno_firma_contrato DESC",
        "$limit": "30",
    }
    url = _build_url(DATOS_GOV_SECOP1, params)
    try:
        return _fetch_json(url), None
    except Exception as exc:  # noqa: BLE001
        return [], str(exc)


def fetch_available_years_secop2_contracts(nits: list[str]) -> tuple[list[dict[str, Any]], str | None]:
    if not nits:
        return [], None
    nit_part = _nit_where("nit_entidad", nits)
    params = {
        "$select": "date_extract_y(fecha_de_firma) as anio, count(1) as total",
        "$where": nit_part,
        "$group": "anio",
        "$order": "anio DESC",
        "$limit": "30",
    }
    url = _build_url(DATOS_GOV_SECOP2_CONTRATOS, params)
    try:
        return _fetch_json(url), None
    except Exception as exc:  # noqa: BLE001
        return [], str(exc)


def fetch_available_years_secop2_processes(nits: list[str]) -> tuple[list[dict[str, Any]], str | None]:
    if not nits:
        return [], None
    nit_part = _nit_where("nit_entidad", nits)
    params = {
        "$select": "date_extract_y(fecha_de_publicacion_del) as anio, count(1) as total",
        "$where": nit_part,
        "$group": "anio",
        "$order": "anio DESC",
        "$limit": "30",
    }
    url = _build_url(DATOS_GOV_SECOP2_PROCESOS, params)
    try:
        return _fetch_json(url), None
    except Exception as exc:  # noqa: BLE001
        return [], str(exc)


def invalidate_entity_cache(nits_i: list[str], nits_ii: list[str], anio: int | None = None) -> int:
    """Elimina claves de caché SECOP para la entidad."""
    keys: list[str] = []
    years = [anio] if anio else list(range(2015, 2031))
    for y in years:
        if nits_i:
            keys.append(f"secop:v1:secop1:{','.join(nits_i)}:{y}")
        if nits_ii:
            keys.append(f"secop:v1:secop2c:{','.join(nits_ii)}:{y}")
            keys.append(f"secop:v1:secop2p:{','.join(nits_ii)}:{y}")
    deleted = 0
    for key in keys:
        if cache.delete(key):
            deleted += 1
    return deleted
