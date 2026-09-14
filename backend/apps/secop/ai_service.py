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
from .analytics import (
    agrupar_por_responsable,
    buckets_vencimiento,
    compute_analytics,
    compute_avance,
    compute_kpis,
    curva_pagos,
    merge_year_trends,
    public_summary,
)
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
    {
        "type": "function",
        "function": {
            "name": "contratos_por_vencer",
            "description": "Contratos por vencer en los próximos días.",
            "parameters": {
                "type": "object",
                "properties": {"anio": {"type": "integer"}, "dias": {"type": "integer", "default": 30}},
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contratos_sin_liquidar",
            "description": "Contratos vencidos sin liquidación registrada.",
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
            "name": "ejecucion_por_responsable",
            "description": "Agregados por supervisor u ordenador del gasto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "anio": {"type": "integer"},
                    "campo": {"type": "string", "enum": ["supervisor", "ordenador_gasto"]},
                },
                "required": ["anio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "serie_mensual",
            "description": "Serie mensual de contratación y pagos.",
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
            "name": "generar_grafico",
            "description": "Genera especificación de gráfico para mostrar al usuario.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string", "enum": ["bar", "line", "pie", "area"]},
                    "titulo": {"type": "string"},
                    "formato": {"type": "string", "enum": ["moneda", "numero", "porcentaje"]},
                    "eje_x": {"type": "string"},
                    "eje_y": {"type": "string"},
                    "datos": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "valor": {"type": "number"},
                            },
                        },
                    },
                },
                "required": ["tipo", "titulo", "datos"],
            },
        },
    },
]

_SYSTEM_ANALISIS = """Eres un analista experto en contratación pública colombiana (SECOP I y SECOP II).
Responde SOLO con un objeto JSON válido con esta estructura exacta:
{
  "resumen_ejecutivo": "string (2-4 oraciones)",
  "indicadores_clave": [{"label": "", "valor": "", "tendencia": "sube|baja|estable", "detalle": ""}],
  "hallazgos": [{"titulo": "", "detalle": "", "severidad": "alta|media|baja", "metrica": ""}],
  "riesgos": [{"titulo": "", "detalle": "", "severidad": "critica|alta|media|baja", "impacto": ""}],
  "recomendaciones": [{"titulo": "", "accion": "", "prioridad": "alta|media|baja", "plazo": ""}]
}
Usa lenguaje claro para funcionarios públicos. Cita cifras del contexto. No inventes datos."""

_SYSTEM_COPILOT = """Eres el copiloto de contratación de una entidad territorial colombiana.
Respondes solo sobre SECOP I/II de esta entidad usando las herramientas disponibles.
OBLIGATORIO: si el usuario pide un gráfico, diagrama o visualización, debes llamar generar_grafico
con datos numéricos reales obtenidos de otras herramientas en la misma conversación.
No digas que vas a generar un gráfico sin invocar generar_grafico.
Si listas contratos, sé conciso: número de proceso, proveedor, valor, estado. No repitas URLs largas.
Si no hay datos, indícalo. Responde en español, de forma ejecutiva con markdown breve."""

MAX_COPILOT_TOOL_ROUNDS = 5


def _load_datasets(entity: Entity, anio: int) -> tuple[list[dict], list[dict]]:
    secop1, _ = load_secop1_normalized(entity, anio)
    secop2, _ = load_secop2_unified(entity, anio)
    return secop1, secop2


def _build_analysis_context(entity: Entity, anio: int) -> dict[str, Any]:
    secop1, secop2 = _load_datasets(entity, anio)
    all_recs = secop1 + secop2
    analytics_s1 = compute_analytics(secop1)["kpis"] if secop1 else {}
    analytics_s2 = compute_analytics(secop2) if secop2 else {"kpis": {}}
    alerts = compute_alerts(
        secop1, secop2,
        nits_i=resolve_nits_secop_i(entity),
        nits_ii=resolve_nits_secop_ii(entity),
        anio=anio,
    )
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
        "por_supervisor": analytics_s2.get("por_supervisor", [])[:5],
        "vencimientos": analytics_s2.get("vencimientos", {}),
        "pagos": analytics_s2.get("pagos", {}),
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


def _parse_analysis_json(text: str) -> dict[str, Any] | None:
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "resumen_ejecutivo" in data:
            return data
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(text[start : end + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            return None
    return None


def _format_analysis_text(data: dict[str, Any]) -> str:
    parts = [data.get("resumen_ejecutivo", "")]
    for section, title in (
        ("indicadores_clave", "Indicadores clave"),
        ("hallazgos", "Hallazgos"),
        ("riesgos", "Riesgos"),
        ("recomendaciones", "Recomendaciones"),
    ):
        items = data.get(section) or []
        if items:
            parts.append(f"\n### {title}")
            for item in items:
                if isinstance(item, dict):
                    label = item.get("titulo") or item.get("label") or item.get("accion") or ""
                    detail = item.get("detalle") or item.get("detalle") or item.get("valor") or ""
                    parts.append(f"- **{label}**: {detail}")
    return "\n".join(parts)


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
        response_format={"type": "json_object"},
    )
    text = response.choices[0].message.content or ""
    structured = _parse_analysis_json(text)
    result = {
        "anio": anio,
        "analisis": _format_analysis_text(structured) if structured else text,
        "structured": structured,
        "contexto": context,
    }
    cache.set(key, result, 3600)
    return result


def summarize_contract(entity: Entity, record: dict[str, Any], *, user_id: int | None = None) -> dict[str, Any]:
    public = public_record(record)
    public["avance"] = compute_avance(record)
    messages = [
        {
            "role": "system",
            "content": (
                "Resume el contrato/proceso SECOP en español para un funcionario. "
                "Incluye: objeto, valor, estado, plazos, proveedor, pagos y riesgos detectables. Máx. 250 palabras."
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
            str(r.get(k) or "") for k in ("referencia", "numero_proceso", "referencia_contrato", "objeto", "proveedor", "estado", "modalidad")
        ).lower()
        if texto in blob:
            hits.append(public_summary(r, compute_avance(r)))
        if len(hits) >= limite:
            break
    return json.dumps(hits, ensure_ascii=False, default=str)


def _tool_contratos_por_vencer(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    dias = int(args.get("dias") or 30)
    s1, s2 = _load_datasets(entity, anio)
    buckets = buckets_vencimiento(s1 + s2)
    out = []
    for key in ("por_vencer_7", "por_vencer_15", "por_vencer_30", "por_vencer_60"):
        if key.endswith(str(dias)) or dias >= int(key.split("_")[-1]):
            out.extend(buckets.get(key, {}).get("registros", []))
    return json.dumps(out[:20], ensure_ascii=False, default=str)


def _tool_contratos_sin_liquidar(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    s1, s2 = _load_datasets(entity, anio)
    buckets = buckets_vencimiento(s1 + s2)
    return json.dumps(buckets.get("vencidos_sin_liquidar", {}).get("registros", [])[:20], ensure_ascii=False, default=str)


def _tool_ejecucion_por_responsable(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    campo = args.get("campo") or "supervisor"
    s1, s2 = _load_datasets(entity, anio)
    data = agrupar_por_responsable(s1 + s2, campo)
    return json.dumps(data[:15], ensure_ascii=False, default=str)


def _tool_serie_mensual(entity: Entity, args: dict) -> str:
    anio = int(args.get("anio") or 0)
    s1, s2 = _load_datasets(entity, anio)
    analytics = compute_analytics(s2)
    return json.dumps({
        "contratacion": analytics.get("serie_mensual", []),
        "pagos": analytics.get("serie_mensual_pagos", []),
    }, ensure_ascii=False, default=str)


def _normalize_chart_spec(args: dict) -> dict | None:
    datos = args.get("datos")
    if not isinstance(datos, list) or not datos:
        return None
    normalized: list[dict[str, Any]] = []
    for item in datos:
        if not isinstance(item, dict):
            continue
        label = item.get("label") or item.get("name") or item.get("modalidad")
        raw_val = item.get("valor")
        if raw_val is None:
            raw_val = item.get("value") or item.get("count")
        if not label or raw_val is None:
            continue
        try:
            normalized.append({"label": str(label), "valor": float(raw_val)})
        except (TypeError, ValueError):
            continue
    if not normalized:
        return None
    return {
        "tipo": args.get("tipo") or "bar",
        "titulo": args.get("titulo") or "Gráfico",
        "formato": args.get("formato") or "numero",
        "eje_x": args.get("eje_x"),
        "eje_y": args.get("eje_y"),
        "datos": normalized,
    }


def _tool_generar_grafico(entity: Entity, args: dict) -> str:
    chart = _normalize_chart_spec(args) or args
    return json.dumps(chart, ensure_ascii=False, default=str)


def _wants_chart(message: str) -> bool:
    lower = message.lower()
    return any(
        word in lower
        for word in (
            "gráfico",
            "grafico",
            "gráfica",
            "grafica",
            "chart",
            "diagrama",
            "visualiz",
            "dona",
            "pastel",
            "barras",
        )
    )


def _infer_chart(entity: Entity, anio: int, message: str) -> dict | None:
    lower = message.lower()
    _, s2 = _load_datasets(entity, anio)
    analytics = compute_analytics(s2)

    if any(word in lower for word in ("modalidad", "modalidades")):
        items = analytics.get("por_modalidad", [])[:8]
        if not items:
            return None
        return {
            "tipo": "pie",
            "titulo": f"Contratación por modalidad — {anio}",
            "formato": "numero",
            "datos": [{"label": i.get("label") or "Sin modalidad", "valor": i.get("count", 0)} for i in items],
        }

    if any(word in lower for word in ("mes", "mensual", "tendencia", "pagos", "contratado")):
        serie = analytics.get("serie_mensual", [])
        pagos = analytics.get("serie_mensual_pagos", [])
        if not serie and not pagos:
            return None
        meses = sorted({*(s.get("mes") for s in serie), *(p.get("mes") for p in pagos)})
        datos = []
        for mes in meses:
            contrato = next((s.get("valor", 0) for s in serie if s.get("mes") == mes), 0)
            pago = next((p.get("valor", 0) for p in pagos if p.get("mes") == mes), 0)
            datos.append({"label": mes, "valor": float(pago or contrato)})
        return {
            "tipo": "line",
            "titulo": f"Contratación y pagos — {anio}",
            "formato": "moneda",
            "datos": datos,
        }

    if any(word in lower for word in ("supervisor", "ordenador", "responsable", "dependencia")):
        campo = "ordenador_gasto" if "ordenador" in lower else "supervisor"
        groups = agrupar_por_responsable(s2, campo)[:8]
        if not groups:
            return None
        return {
            "tipo": "bar",
            "titulo": f"Valor contratado por {campo.replace('_', ' ')} — {anio}",
            "formato": "moneda",
            "datos": [{"label": g.get("nombre") or "Sin asignar", "valor": g.get("valor_total", 0)} for g in groups],
        }

    if "proveedor" in lower:
        tops = analytics.get("top_proveedores_valor", [])[:8]
        if not tops:
            return None
        return {
            "tipo": "bar",
            "titulo": f"Top proveedores — {anio}",
            "formato": "moneda",
            "datos": [{"label": t.get("proveedor") or "—", "valor": t.get("valor", 0)} for t in tops],
        }

    if _wants_chart(message):
        items = analytics.get("por_modalidad", [])[:8]
        if not items:
            return None
        return {
            "tipo": "pie",
            "titulo": f"Contratación por modalidad — {anio}",
            "formato": "numero",
            "datos": [{"label": i.get("label") or "Sin modalidad", "valor": i.get("count", 0)} for i in items],
        }
    return None


_TOOL_FUNCS = {
    "resumen_vigencia": _tool_resumen_vigencia,
    "listar_alertas": _tool_listar_alertas,
    "top_proveedores": _tool_top_proveedores,
    "buscar_contratos": _tool_buscar_contratos,
    "contratos_por_vencer": _tool_contratos_por_vencer,
    "contratos_sin_liquidar": _tool_contratos_sin_liquidar,
    "ejecucion_por_responsable": _tool_ejecucion_por_responsable,
    "serie_mensual": _tool_serie_mensual,
    "generar_grafico": _tool_generar_grafico,
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
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": _SYSTEM_COPILOT + f" Año de referencia: {anio}."},
        *history[-8:],
        {"role": "user", "content": message},
    ]

    sources: list[dict] = []
    chart: dict | None = None
    registros: list[dict] = []
    reply = ""

    for round_idx in range(MAX_COPILOT_TOOL_ROUNDS):
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

        if not msg.tool_calls:
            reply = msg.content or ""
            break

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
            if tc.function.name == "generar_grafico":
                try:
                    parsed = json.loads(result)
                    chart = _normalize_chart_spec(parsed) or parsed
                except json.JSONDecodeError:
                    chart = _normalize_chart_spec(args)
            elif tc.function.name == "buscar_contratos":
                try:
                    registros = json.loads(result)
                except json.JSONDecodeError:
                    pass
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

        if chart is not None and round_idx >= 1:
            final = chat_completion(
                "secop_copilot",
                messages,
                entity_id=entity.id,
                user_id=user_id,
                temperature=0.3,
            )
            reply = final.choices[0].message.content or ""
            break
    else:
        final = chat_completion(
            "secop_copilot",
            messages,
            entity_id=entity.id,
            user_id=user_id,
            temperature=0.3,
        )
        reply = final.choices[0].message.content or ""

    if chart is None and _wants_chart(message):
        chart = _infer_chart(entity, anio, message)

    return {"reply": reply, "sources": sources, "chart": chart, "registros": registros}
