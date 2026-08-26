"""Huella estable para insights IA (sin id en base de datos)."""
from __future__ import annotations

import hashlib
import re
from typing import Any


def _normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", (title or "").strip().lower())


def _reference_key(insight: dict[str, Any]) -> str:
    meta = insight.get("metadata") or {}
    for key in ("codigo_producto", "pqrs_id", "numero_radicado"):
        val = meta.get(key)
        if val:
            return str(val)
    return ""


def insight_fingerprint(module: str, insight: dict[str, Any]) -> str:
    title = _normalize_title(str(insight.get("title", "")))
    ref = _reference_key(insight)
    raw = f"{module}|{title}|{ref}"
    return hashlib.sha1(raw.encode()).hexdigest()


def attach_insight_fingerprints(module: str, insights: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in insights:
        enriched = dict(item)
        enriched["fingerprint"] = insight_fingerprint(module, item)
        out.append(enriched)
    return out


def filter_ignored_insights(
    entity_id: int,
    module: str,
    insights: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    from .models import AIInsightIgnorado

    ignored = set(
        AIInsightIgnorado.objects.filter(entity_id=entity_id, module=module).values_list(
            "fingerprint", flat=True
        )
    )
    if not ignored:
        return insights
    return [i for i in insights if i.get("fingerprint") not in ignored]
