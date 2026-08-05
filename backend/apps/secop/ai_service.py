"""Servicios de IA para análisis SECOP."""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from django.core.cache import cache

from apps.ai.client import chat_completion
from apps.entities.models import Entity

from .access import resolve_nits_secop_i, resolve_nits_secop_ii
from .alerts import compute_alerts
from .analytics import compute_analytics, compute_kpis, merge_year_trends
from .datasets import (
    fetch_available_years_secop1,
    fetch_available_years_secop2_contracts,
)
from .normalize import public_record
from .unify import load_secop1_normalized, load_secop2_unified

logger = logging.getLogger(__name__)

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "resumen_vigencia",
            "description": "KPIs consolidados de contratación SECOP I y II para un año.",
            "parameters": {
                "type": "object",
                "properties": {"anio": {"type": "integer"}},
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_alertas",
            "description": "Alertas de riesgo detectadas en la contratación de la entidad.",
            "parameters": {
                "type": "object",
                "properties": {"anio": {"type": "integer"}},
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "top_proveedores",
            "description": "Top proveedores por valor contratado en un año.",
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {"type": "integer"},
                    "limite": {"type": "integer", "default": 5},
                },
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_contratos",
            "description": "Busca contratos/procesos por texto en objeto, referencia o proveedor.",
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {"type": "integer"},
                    "texto": {"type": "string"},
                    "limite": {"type": "integer", "default": 10},
                },
                "required": ["anio", "texto"],
            },
        },
    },
]

_SYSTEM_ANALISIS = """Eres un analista experto en contratación pública colombiana (SECOP I y SECOP II).
Analiza los indicadores agregados de la entidad territorial y entrega:
1) Hallazgos principales (máx. 5 bullets)
2) Riesgos priorizados (máx. 5, con severidad)
3) Recomendaciones concretas para la entidad (máx. 5)
Usa lenguaje claro para funcionarios públicos. Cita cifras del contexto. No inventes datos."""

_SYSTEM_COPILOT = """Eres el copiloto de contratación de una entidad territorial colombiana.
Respondes solo sobre SECOP I/II de esta entidad usando las herramientas disponibles.
Si no hay datos, indícalo. Responde en español, de forma ejecutiva."""


def _load_datasets(entity: Entity, anio: int) -> tuple[list[dict], list[dict]]:
    nits_i = resolve_nits_secop_i(entity)
    nits_ii = resolve_nits_secop_ii(entity)
    secop1, _ = load_secop1_normalized(nits_i, anio)
    secop2, _ = load_secop2_unified(nits_ii, anio)
    return secop1, secop2


def _build_analysis_context(entity: Entity, anio: int) -> dict[str, Any]:
    secop1, secop2 = _load_datasets(entity, anio)
    all_recs = secop1 + secop2
    analytics_s1 = compute_analytics(secop1)["kpis"] if secop1 else {}
    analytics_s2 = compute_analytics(secop2) if secop2 else {"kpis": {}}
    alerts = compute_alerts(secop1, secop2, nits_i=resolve_nits_secop_i(entity), nits_ii=resolve_nits_secop_ii(entity), anio=anio)
    nits_i = resolve_nits_secop_i(entity)
    nits_ii = resolve_nits_secop_ii(entity)
    trend1, _ = fetch_available_years_secop1(nits_i)
    trend2, _ = fetch_available_years_secop2_contracts(nits_ii)
    return {
        "entidad": entity.name,
        "anio": anio,
        "kpis_consolidados": compute_kpis(all_recs),
        "kpis_secop1": analytics_s1,
        "kpis_secop2": analytics_s2.get("kpis", {}),
        "hhi_secop2": analytics_s2.get("hhi"),
        "top_proveedores": analytics_s2.get("top_proveedores_valor", [])[:5],
        "por_modalidad": analytics_s2.get("por_modalidad", [])[:6],
        "alertas_resumen": [
            {"severidad": a["severidad"], "titulo": a["titulo"], "cantidad": a["cantidad"]}
            for a in alerts[:12]
        ],
        "tendencia_secop1": merge_year_trends(trend1)[-8:],
        "tendencia_secop2": merge_year_trends(trend2)[-8:],
    }


def _cache_key(prefix: str, entity_id: int, anio: int, payload: dict) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()[:16]
    return f"secop:ai:{prefix}:{entity_id}:{anio}:{digest}"


def generate_secop_analysis(entity: Entity, anio: int, *, user_id: int | None = None) -> dict[str, Any]:
    context = _build_analysis_context(entity, anio)
    key = _cache_key("analisis", entity.id, anio, context)
    cached = cache.get(key)
    if cached:
        return cached

    messages = [
        {"role": "system", "content": _SYSTEM_ANALISIS},
        {
            "role": "user",
            "content": (
                f"Analiza la contratación de {entity.name} para la vigencia {anio}.\n\n"
                f"Contexto JSON:\n{json.dumps(context, ensure_ascii=False, indent=2)}"
            ),
        },
    ]
    response = chat_completion(
        "secop_analisis",
        messages,
        entity_id=entity.id,
        user_id=user_id,
        temperature=0.2,
    )
    text = response.choices[0].message.content or ""
    result = {
        "anio": anio,
        "analisis": text,
        "contexto": context,
    }
    cache.set(key, result, 3600)
    return result


def summarize_contract(entity: Entity, record: dict[str, Any], *, user_id: int | None = None) -> dict[str, Any]:
    public = public_record(record)
    messages = [
        {
            "role": "system",
            "content": (
                "Resume el contrato/proceso SECOP en español para un funcionario. "
                "Incluye: objeto, valor, estado, plazos, proveedor y riesgos detectables. Máx. 250 palabras."
            ),
        },
        {"role": "user", "content": json.dumps(public, ensure_ascii=False, default=str)},
    ]
    response = chat_completion(
        "secop_contrato",
        messages,
        entity_id=entity.id,
        user_id=user_id,
        temperature=0.2,
    )
    return {"resumen": response.choices[0].message.content or "", "registro": public}


def _tool_resumen_vigencia(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    ctx = _build_analysis_context(entity, anio)
    return json.dumps(ctx, ensure_ascii=False, default=str)


def _tool_listar_alertas(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    s1, s2 = _load_datasets(entity, anio)
    alerts = compute_alerts(
        s1, s2,
        nits_i=resolve_nits_secop_i(entity),
        nits_ii=resolve_nits_secop_ii(entity),
        anio=anio,
    )
    return json.dumps(alerts[:15], ensure_ascii=False, default=str)


def _tool_top_proveedores(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    limite = int(args.get("limite") or 5)
    _, s2 = _load_datasets(entity, anio)
    analytics = compute_analytics(s2)
    tops = analytics.get("top_proveedores_valor", [])[:limite]
    return json.dumps(tops, ensure_ascii=False, default=str)


def _tool_buscar_contratos(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    texto = (args.get("texto") or "").lower().strip()
    limite = int(args.get("limite") or 10)
    s1, s2 = _load_datasets(entity, anio)
    hits = []
    for r in s1 + s2:
        blob = " ".join(
            str(r.get(k) or "") for k in ("referencia", "objeto", "proveedor", "estado", "modalidad")
        ).lower()
        if texto in blob:
            hits.append(public_record(r))
        if len(hits) >= limite:
            break
    return json.dumps(hits, ensure_ascii=False, default=str)


_TOOL_FUNCS = {
    "resumen_vigencia": _tool_resumen_vigencia,
    "listar_alertas": _tool_listar_alertas,
    "top_proveedores": _tool_top_proveedores,
    "buscar_contratos": _tool_buscar_contratos,
}


def execute_tool(entity: Entity, name: str, arguments: dict) -> str:
    fn = _TOOL_FUNCS.get(name)
    if not fn:
        return json.dumps({"error": f"Herramienta desconocida: {name}"})
    return fn(entity, arguments)


def run_secop_copilot(
    entity: Entity,
    message: str,
    *,
    anio: int,
    history: list[dict[str, str]] | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    history = history or []
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _SYSTEM_COPILOT + f" Año de referencia: {anio}."},
        *history[-8:],
        {"role": "user", "content": message},
    ]

    response = chat_completion(
        "secop_copilot",
        messages,
        entity_id=entity.id,
        user_id=user_id,
        tools=TOOL_DEFINITIONS,
        tool_choice="auto",
        temperature=0.3,
    )
    msg = response.choices[0].message
    sources: list[dict] = []

    if msg.tool_calls:
        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            }
        )
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = execute_tool(entity, tc.function.name, args)
            sources.append({"tool": tc.function.name, "preview": result[:500]})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

        final = chat_completion(
            "secop_copilot",
            messages,
            entity_id=entity.id,
            user_id=user_id,
            temperature=0.3,
        )
        reply = final.choices[0].message.content or ""
    else:
        reply = msg.content or ""

    return {"reply": reply, "sources": sources}
