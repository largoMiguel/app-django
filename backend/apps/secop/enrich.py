"""Enriquecimiento SECOP II con facturas y modificaciones."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from django.conf import settings

from .datasets import fetch_secop2_facturas, fetch_secop2_modificaciones
from .normalize import _parse_date, _parse_float  # noqa: PLC2701


def _is_liquidado(val: Any) -> bool:
    text = str(val or "").strip().lower()
    return text in {"si", "sí", "yes", "true", "1"}


def _normalize_pago(row: dict[str, Any]) -> dict[str, Any]:
    fecha = row.get("fecha_factura") or row.get("fecha_de_entrega") or row.get("fecha_estiamda_de_pago")
    return {
        "id_pago": row.get("id_pago"),
        "numero_factura": row.get("numero_de_factura"),
        "fecha": str(fecha)[:19] if fecha else None,
        "valor_neto": _parse_float(row.get("valor_neto")),
        "valor_total": _parse_float(row.get("valor_total") or row.get("valor_a_pagar")),
        "estado": row.get("estado"),
        "pago_confirmado": str(row.get("pago_confirmado") or "").lower() in {"true", "1", "si", "sí"},
        "notas": row.get("notas"),
        "radicado": row.get("radicado"),
    }


def _normalize_modificacion(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "identificador": row.get("identificador_modificacion") or row.get("identificador"),
        "tipo": row.get("tipo") or row.get("proposito_modificacion"),
        "descripcion": row.get("descripcion") or row.get("proposito_modificacion"),
        "fecha_aprobacion": str(row.get("fecha_de_aprobacion") or "")[:10] or None,
        "valor_modificacion": _parse_float(row.get("valor_modificacion")),
        "dias_extendidos": int(_parse_float(row.get("dias_extendidos"))),
        "fecha_fin_contrato": str(row.get("fecha_fin_contrato") or "")[:10] or None,
        "liquidacion": row.get("liquidaci_n") or row.get("liquidacion"),
        "estado": row.get("estado_modificacion"),
        "numero_version": int(_parse_float(row.get("numero_version"))),
    }


def _dedupe_modificaciones(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        estado = str(row.get("estado_modificacion") or "").strip().lower()
        if estado == "rechazado":
            continue
        key = str(row.get("identificador_modificacion") or row.get("identificador") or "").strip()
        if not key:
            continue
        version = int(_parse_float(row.get("numero_version")))
        prev = by_id.get(key)
        if prev is None or version >= int(_parse_float(prev.get("numero_version"))):
            by_id[key] = row
    return list(by_id.values())


def _summarize_modificaciones(rows: list[dict[str, Any]]) -> dict[str, Any]:
    normalized = [_normalize_modificacion(r) for r in _dedupe_modificaciones(rows)]
    valor_adiciones = sum(m["valor_modificacion"] for m in normalized if m["valor_modificacion"] > 0)
    dias_prorrogados = sum(m["dias_extendidos"] for m in normalized if m["dias_extendidos"] > 0)
    liquidado = any(_is_liquidado(m.get("liquidacion")) for m in normalized)
    suspensiones = [
        m for m in normalized
        if "suspens" in (m.get("tipo") or "").lower() or "suspens" in (m.get("descripcion") or "").lower()
    ]
    fecha_fin_efectiva = None
    for m in sorted(normalized, key=lambda x: x.get("numero_version") or 0):
        if m.get("fecha_fin_contrato"):
            fecha_fin_efectiva = m["fecha_fin_contrato"]
    return {
        "modificaciones": sorted(normalized, key=lambda x: x.get("fecha_aprobacion") or ""),
        "valor_adiciones": round(valor_adiciones, 2),
        "dias_prorrogados": dias_prorrogados,
        "fecha_fin_efectiva": fecha_fin_efectiva,
        "liquidado": liquidado,
        "suspensiones": suspensiones,
    }


def _summarize_pagos(rows: list[dict[str, Any]]) -> dict[str, Any]:
    pagos = sorted(
        [_normalize_pago(r) for r in rows],
        key=lambda p: p.get("fecha") or "",
    )
    confirmados = [p for p in pagos if p.get("pago_confirmado") or (p.get("estado") or "").lower() == "pagado"]
    total_pagado = sum(p["valor_total"] for p in confirmados)
    pendientes = [p for p in pagos if (p.get("estado") or "").lower() not in {"pagado", "anulado"}]
    ultimo = confirmados[-1]["fecha"][:10] if confirmados and confirmados[-1].get("fecha") else None
    return {
        "pagos": pagos,
        "total_pagado_real": round(total_pagado, 2),
        "numero_pagos": len(confirmados),
        "ultimo_pago": ultimo,
        "pagos_pendientes": len(pendientes),
    }


def enrich_secop2(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not getattr(settings, "SECOP_ENRICH_ENABLED", True):
        return records

    contratos = [r for r in records if r.get("tipo_registro") == "contrato" and r.get("fuente") == "secop2"]
    max_c = int(getattr(settings, "SECOP_ENRICH_MAX_CONTRATOS", 500))
    ids = [str(r["id"]) for r in contratos[:max_c]]
    if not ids:
        return records

    facturas_raw, _ = fetch_secop2_facturas(ids)
    mods_raw, _ = fetch_secop2_modificaciones(ids)

    by_id_facturas: dict[str, list[dict]] = defaultdict(list)
    for row in facturas_raw:
        cid = str(row.get("id_contrato") or "").strip()
        if cid:
            by_id_facturas[cid].append(row)

    by_id_mods: dict[str, list[dict]] = defaultdict(list)
    for row in mods_raw:
        cid = str(row.get("id_contrato") or "").strip()
        if cid:
            by_id_mods[cid].append(row)

    out: list[dict[str, Any]] = []
    for rec in records:
        if rec.get("tipo_registro") != "contrato" or rec.get("fuente") != "secop2":
            out.append(rec)
            continue
        cid = str(rec.get("id") or "")
        pago_info = _summarize_pagos(by_id_facturas.get(cid, []))
        mod_info = _summarize_modificaciones(by_id_mods.get(cid, []))

        enriched = dict(rec)
        enriched["pagos"] = pago_info["pagos"]
        enriched["total_pagado_real"] = pago_info["total_pagado_real"]
        enriched["numero_pagos"] = pago_info["numero_pagos"]
        enriched["ultimo_pago"] = pago_info["ultimo_pago"]
        enriched["pagos_pendientes"] = pago_info["pagos_pendientes"]
        enriched["modificaciones"] = mod_info["modificaciones"]
        enriched["dias_prorrogados"] = mod_info["dias_prorrogados"]
        enriched["suspensiones"] = mod_info["suspensiones"]

        if pago_info["total_pagado_real"] > 0:
            enriched["valor_pagado"] = pago_info["total_pagado_real"]
            valor_base = _parse_float(enriched.get("valor_con_adiciones") or enriched.get("valor"))
            enriched["valor_pendiente"] = max(valor_base - pago_info["total_pagado_real"], 0.0)

        if mod_info["valor_adiciones"] > 0:
            base = _parse_float(enriched.get("valor"))
            enriched["valor_adiciones"] = mod_info["valor_adiciones"]
            enriched["valor_con_adiciones"] = round(base + mod_info["valor_adiciones"], 2)

        if mod_info["fecha_fin_efectiva"]:
            enriched["fecha_fin"] = mod_info["fecha_fin_efectiva"]

        if mod_info["liquidado"]:
            enriched["liquidacion"] = "Si"

        out.append(enriched)
    return out
