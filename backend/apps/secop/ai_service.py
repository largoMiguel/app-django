"""Servicios de IA para análisis SECOP."""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from typing import Any

from django.core.cache import cache

from apps.ai.client import chat_completion, get_api_key_for_feature
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
            "name": "por_modalidad",
            "description": "Conteo de contratos SECOP II por modalidad (ligero, ideal para gráficos).",
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
Para gráficos por modalidad usa por_modalidad; para tendencias mensuales usa serie_mensual.
Evita resumen_vigencia salvo que el usuario pida un panorama completo de la vigencia.
No digas que vas a generar un gráfico sin invocar generar_grafico.
Si listas contratos, sé conciso: número de proceso, proveedor, valor, estado. No repitas URLs largas.
Si no hay datos, indícalo. Responde en español, de forma ejecutiva con markdown breve."""

MAX_COPILOT_TOOL_ROUNDS = 5


def _load_datasets(entity: Entity, anio: int) -> tuple[list[dict], list[dict]]:
    secop1, _ = load_secop1_normalized(entity, anio)
    secop2, _ = load_secop2_unified(entity, anio)
    return secop1, secop2


class CopilotRunContext:
    """Caché de datasets y métricas de tiempo dentro de una sola consulta al copiloto."""

    def __init__(self, entity: Entity, anio: int):
        self.entity = entity
        self.anio = anio
        self._s1: list[dict] | None = None
        self._s2: list[dict] | None = None
        self._analytics_s2: dict[str, Any] | None = None
        self.timing: dict[str, Any] = {
            "data_load_ms": 0,
            "llm_ms": 0,
            "tools": [],
            "fast_path": False,
        }

    def datasets(self) -> tuple[list[dict], list[dict]]:
        if self._s1 is None:
            t0 = time.monotonic()
            self._s1, self._s2 = _load_datasets(self.entity, self.anio)
            self.timing["data_load_ms"] += int((time.monotonic() - t0) * 1000)
        return self._s1, self._s2

    def analytics_s2(self) -> dict[str, Any]:
        if self._analytics_s2 is None:
            _, secop2 = self.datasets()
            self._analytics_s2 = compute_analytics(secop2) if secop2 else {"kpis": {}}
        return self._analytics_s2


def _build_analysis_context(
    entity: Entity,
    anio: int,
    *,
    secop1: list[dict] | None = None,
    secop2: list[dict] | None = None,
) -> dict[str, Any]:
    if secop1 is None or secop2 is None:
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


def _tool_resumen_vigencia(ctx: CopilotRunContext, args: dict) -> str:
    anio = int(args.get("anio") or ctx.anio)
    if anio == ctx.anio:
        s1, s2 = ctx.datasets()
        data = _build_analysis_context(ctx.entity, anio, secop1=s1, secop2=s2)
    else:
        data = _build_analysis_context(ctx.entity, anio)
    return json.dumps(data, ensure_ascii=False, default=str)


def _tool_listar_alertas(ctx: CopilotRunContext, args: dict) -> str:
    anio = int(args.get("anio") or ctx.anio)
    s1, s2 = ctx.datasets()
    alerts = compute_alerts(
        s1, s2,
        nits_i=resolve_nits_secop_i(ctx.entity),
        nits_ii=resolve_nits_secop_ii(ctx.entity),
        anio=anio,
    )
    return json.dumps(alerts[:15], ensure_ascii=False, default=str)


def _tool_top_proveedores(ctx: CopilotRunContext, args: dict) -> str:
    limite = int(args.get("limite") or 5)
    tops = ctx.analytics_s2().get("top_proveedores_valor", [])[:limite]
    return json.dumps(tops, ensure_ascii=False, default=str)


def _tool_buscar_contratos(ctx: CopilotRunContext, args: dict) -> str:
    texto = (args.get("texto") or "").lower().strip()
    limite = int(args.get("limite") or 10)
    s1, s2 = ctx.datasets()
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


def _tool_contratos_por_vencer(ctx: CopilotRunContext, args: dict) -> str:
    dias = int(args.get("dias") or 30)
    s1, s2 = ctx.datasets()
    buckets = buckets_vencimiento(s1 + s2)
    out = []
    for key in ("por_vencer_7", "por_vencer_15", "por_vencer_30", "por_vencer_60"):
        if key.endswith(str(dias)) or dias >= int(key.split("_")[-1]):
            out.extend(buckets.get(key, {}).get("registros", []))
    return json.dumps(out[:20], ensure_ascii=False, default=str)


def _tool_contratos_sin_liquidar(ctx: CopilotRunContext, args: dict) -> str:
    s1, s2 = ctx.datasets()
    buckets = buckets_vencimiento(s1 + s2)
    return json.dumps(buckets.get("vencidos_sin_liquidar", {}).get("registros", [])[:20], ensure_ascii=False, default=str)


def _tool_ejecucion_por_responsable(ctx: CopilotRunContext, args: dict) -> str:
    campo = args.get("campo") or "supervisor"
    s1, s2 = ctx.datasets()
    data = agrupar_por_responsable(s1 + s2, campo)
    return json.dumps(data[:15], ensure_ascii=False, default=str)


def _tool_serie_mensual(ctx: CopilotRunContext, args: dict) -> str:
    analytics = ctx.analytics_s2()
    return json.dumps({
        "contratacion": analytics.get("serie_mensual", []),
        "pagos": analytics.get("serie_mensual_pagos", []),
    }, ensure_ascii=False, default=str)


def _tool_por_modalidad(ctx: CopilotRunContext, args: dict) -> str:
    items = ctx.analytics_s2().get("por_modalidad", [])
    return json.dumps(items, ensure_ascii=False, default=str)


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


def _tool_generar_grafico(ctx: CopilotRunContext, args: dict) -> str:
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
            "torta",
            "histograma",
        )
    )


def _infer_chart_type(message: str, *, default: str = "bar") -> str:
    lower = message.lower()
    if any(w in lower for w in ("torta", "pastel", "pie", "dona", "circular")):
        return "pie"
    if any(w in lower for w in ("linea", "línea", "line", "tendencia", "evolución", "evolucion")):
        return "line"
    if any(w in lower for w in ("area", "área")):
        return "area"
    if any(w in lower for w in ("barra", "barras", "columna", "columnas", "histograma")):
        return "bar"
    return default


def _infer_chart(ctx: CopilotRunContext, message: str) -> dict | None:
    lower = message.lower()
    anio = ctx.anio
    _, s2 = ctx.datasets()
    analytics = ctx.analytics_s2()

    if any(word in lower for word in ("modalidad", "modalidades")):
        items = analytics.get("por_modalidad", [])[:8]
        if not items:
            return None
        return {
            "tipo": _infer_chart_type(message, default="pie"),
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
            "tipo": _infer_chart_type(message, default="line"),
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
            "tipo": _infer_chart_type(message, default="bar"),
            "titulo": f"Valor contratado por {campo.replace('_', ' ')} — {anio}",
            "formato": "moneda",
            "datos": [{"label": g.get("nombre") or "Sin asignar", "valor": g.get("valor_total", 0)} for g in groups],
        }

    if "proveedor" in lower:
        tops = analytics.get("top_proveedores_valor", [])[:8]
        if not tops:
            return None
        return {
            "tipo": _infer_chart_type(message, default="bar"),
            "titulo": f"Top proveedores — {anio}",
            "formato": "moneda",
            "datos": [{"label": t.get("proveedor") or "—", "valor": t.get("valor", 0)} for t in tops],
        }

    if _wants_chart(message):
        items = analytics.get("por_modalidad", [])[:8]
        if not items:
            return None
        return {
            "tipo": _infer_chart_type(message, default="bar"),
            "titulo": f"Contratación por modalidad — {anio}",
            "formato": "numero",
            "datos": [{"label": i.get("label") or "Sin modalidad", "valor": i.get("count", 0)} for i in items],
        }
    return None


def _format_chart_reply(chart: dict, anio: int) -> str:
    titulo = chart.get("titulo") or f"Gráfico — {anio}"
    datos = chart.get("datos") or []
    formato = chart.get("formato") or "numero"
    total = sum(float(d.get("valor") or 0) for d in datos)
    lines: list[str] = []
    for item in datos:
        label = item.get("label") or "—"
        val = float(item.get("valor") or 0)
        if formato == "moneda":
            val_str = f"${val:,.0f}"
        elif formato == "porcentaje":
            val_str = f"{val:.1f}%"
        else:
            val_str = f"{val:,.0f}"
        extra = ""
        if formato == "numero" and total > 0 and chart.get("tipo") == "pie":
            extra = f" ({100 * val / total:.0f}%)"
        lines.append(f"- **{label}**: {val_str}{extra}")
    return f"### {titulo}\n\n" + "\n".join(lines)


def _try_fast_chart_response(ctx: CopilotRunContext, message: str) -> dict[str, Any] | None:
    if not _wants_chart(message):
        return None
    chart = _infer_chart(ctx, message)
    if not chart:
        return None
    ctx.timing["fast_path"] = True
    return {
        "reply": _format_chart_reply(chart, ctx.anio),
        "sources": [{"tool": "fast_chart", "preview": json.dumps(chart.get("datos", [])[:3], ensure_ascii=False)}],
        "chart": chart,
        "registros": [],
    }


_SEARCH_STOPWORDS = frozenset({
    "y", "de", "el", "la", "los", "las", "un", "una", "por", "con", "que", "cual", "cuál",
    "cuanto", "cuánto", "cualto", "vale", "valor", "contrato", "contratos", "proceso", "precio",
    "muestrame", "muestra", "dame", "busca", "buscar", "encuentra", "listar", "dime", "sobre",
    "hazme", "haz", "resumen", "resume", "resúmen", "explica", "detalla", "amplia", "analiza",
    "analisis", "análisis", "riesgo", "riesgos", "alerta", "alertas", "recomienda", "recomendacion",
})

_FOLLOWUP_HINTS = (
    "resumen", "resume", "resúmen", "explica", "detalla", "amplia", "mas info", "más info",
    "y ese", "y eso", "continua", "continúa", "detalle", "desglosa",
)


def _extract_search_text(message: str) -> str | None:
    for pattern in (r"\bde\s+([a-záéíóúñ0-9]+)", r"\bpor\s+([a-záéíóúñ0-9]+)", r"\bcon\s+([a-záéíóúñ0-9]+)"):
        match = re.search(pattern, message, re.I)
        if match:
            word = re.sub(r"[^\wáéíóúñ]", "", match.group(1).lower())
            if len(word) >= 3 and word not in _SEARCH_STOPWORDS:
                return word
    return None


def _is_followup_request(message: str) -> bool:
    lower = message.lower().strip()
    return any(hint in lower for hint in _FOLLOWUP_HINTS)


def _last_search_term(history: list[dict[str, str]]) -> str | None:
    for msg in reversed(history):
        if msg.get("role") != "user":
            continue
        term = _extract_search_text(msg.get("content") or "")
        if term:
            return term
    return None


def _looks_like_contract_query(message: str) -> bool:
    lower = message.lower()
    if _is_followup_request(message):
        return False
    contract_words = (
        "contrato", "valor", "cuanto", "cuánto", "cualto", "vale", "precio",
        "proveedor", "proceso", "adjudic", "pagado", "liquid",
    )
    has_contract_context = any(w in lower for w in contract_words)
    has_entity_ref = bool(re.search(r"\bde\s+[a-záéíóúñ0-9]", lower, re.I))
    if has_entity_ref and has_contract_context:
        return True
    if any(w in lower for w in ("busca", "buscar", "encuentra", "listar")) and _extract_search_text(message):
        return True
    return False


def _format_contract_search_reply(texto: str, registros: list[dict], anio: int) -> str:
    lines = [f"Contratos que coinciden con **{texto}** — vigencia {anio}:\n"]
    for reg in registros[:8]:
        lines.append(_format_contract_line(reg))
    if len(registros) > 8:
        lines.append(f"\n_Y {len(registros) - 8} más…_")
    return "\n".join(lines)


def _format_contract_line(reg: dict) -> str:
    ref = reg.get("referencia") or reg.get("numero_proceso") or "—"
    proveedor = reg.get("proveedor") or "Sin proveedor"
    valor = reg.get("valor")
    estado = reg.get("estado") or "—"
    valor_txt = f"${float(valor):,.0f}" if valor is not None else "N/D"
    pagado = reg.get("valor_pagado")
    pagado_txt = f" · pagado ${float(pagado):,.0f}" if pagado else ""
    return f"- **{ref}** — {proveedor}: {valor_txt}{pagado_txt} ({estado})"


def _format_contract_detail_reply(texto: str, registros: list[dict], anio: int) -> str:
    reg = registros[0]
    ref = reg.get("referencia") or reg.get("numero_proceso") or "—"
    proveedor = reg.get("proveedor") or "Sin proveedor"
    valor = reg.get("valor")
    pagado = reg.get("valor_pagado")
    avance = reg.get("avance_pct")
    lines = [
        f"### Resumen — {ref}",
        f"**Proveedor:** {proveedor}",
        f"**Estado:** {reg.get('estado') or '—'}",
        f"**Valor contrato:** ${float(valor):,.0f}" if valor is not None else "**Valor contrato:** N/D",
    ]
    if pagado:
        lines.append(f"**Pagado:** ${float(pagado):,.0f}")
    if avance is not None:
        lines.append(f"**Avance financiero:** {float(avance):.0f}%")
    if reg.get("fecha_fin"):
        lines.append(f"**Fecha fin:** {reg.get('fecha_fin')}")
    if reg.get("supervisor"):
        lines.append(f"**Supervisor:** {reg.get('supervisor')}")
    if len(registros) > 1:
        lines.append(f"\n_Otros {len(registros) - 1} contrato(s) relacionados con «{texto}» en {anio}._")
    return "\n".join(lines)


def _format_alerts_reply(alerts: list[dict], anio: int) -> str:
    if not alerts:
        return f"No se detectaron alertas relevantes para la vigencia {anio}."
    lines = [f"### Principales alertas — {anio}\n"]
    for alert in alerts[:8]:
        lines.append(
            f"- **[{alert.get('severidad', '—').upper()}]** {alert.get('titulo', 'Alerta')}"
            f" — {alert.get('cantidad', 0)} caso(s)"
        )
        if alert.get("detalle"):
            lines.append(f"  {alert['detalle']}")
    return "\n".join(lines)


def _format_top_proveedores_reply(items: list[dict], anio: int) -> str:
    if not items:
        return f"No hay proveedores destacados en la vigencia {anio}."
    lines = [f"### Top proveedores por valor — {anio}\n"]
    for item in items[:8]:
        lines.append(
            f"- **{item.get('proveedor') or '—'}**: "
            f"${float(item.get('valor') or 0):,.0f} ({item.get('count', 0)} contrato(s))"
        )
    return "\n".join(lines)


def _format_vigencia_snapshot(ctx: CopilotRunContext) -> str:
    analytics = ctx.analytics_s2()
    kpis = analytics.get("kpis", {})
    lines = [f"### Panorama de contratación — {ctx.anio}\n"]
    mapping = (
        ("total_contratos", "Contratos"),
        ("valor_total", "Valor contratado"),
        ("valor_pagado", "Valor pagado"),
        ("contratos_ejecucion", "En ejecución"),
    )
    for key, label in mapping:
        val = kpis.get(key)
        if val is None:
            continue
        if "valor" in key:
            lines.append(f"- **{label}:** ${float(val):,.0f}")
        else:
            lines.append(f"- **{label}:** {val}")
    modalidades = analytics.get("por_modalidad", [])[:4]
    if modalidades:
        lines.append("\n**Por modalidad:**")
        for item in modalidades:
            lines.append(f"- {item.get('label') or '—'}: {item.get('count', 0)}")
    return "\n".join(lines)


def _run_tool_and_parse(ctx: CopilotRunContext, tool: str, args: dict) -> tuple[str, Any]:
    t0 = time.monotonic()
    result = execute_tool(ctx, tool, args)
    ctx.timing["tools"].append({"name": tool, "ms": int((time.monotonic() - t0) * 1000)})
    try:
        return result, json.loads(result)
    except json.JSONDecodeError:
        return result, None


def _try_followup_response(
    ctx: CopilotRunContext,
    message: str,
    history: list[dict[str, str]],
) -> dict[str, Any] | None:
    if not history or not _is_followup_request(message):
        return None
    term = _last_search_term(history)
    if term:
        raw, registros = _run_tool_and_parse(ctx, "buscar_contratos", {"anio": ctx.anio, "texto": term, "limite": 5})
        if registros:
            ctx.timing["fast_path"] = True
            return {
                "reply": _format_contract_detail_reply(term, registros, ctx.anio),
                "sources": [{"tool": "buscar_contratos", "preview": raw[:500]}],
                "chart": None,
                "registros": registros,
            }
    ctx.timing["fast_path"] = True
    return {
        "reply": _format_vigencia_snapshot(ctx),
        "sources": [{"tool": "analytics_s2", "preview": "snapshot"}],
        "chart": None,
        "registros": [],
    }


def _try_tool_intent_response(ctx: CopilotRunContext, message: str) -> dict[str, Any] | None:
    if _wants_chart(message) or _is_followup_request(message):
        return None
    lower = message.lower()
    anio = ctx.anio

    if any(w in lower for w in ("riesgo", "riesgos", "alerta", "alertas", "problema")):
        raw, alerts = _run_tool_and_parse(ctx, "listar_alertas", {"anio": anio})
        if alerts is not None:
            ctx.timing["fast_path"] = True
            return {
                "reply": _format_alerts_reply(alerts, anio),
                "sources": [{"tool": "listar_alertas", "preview": raw[:500]}],
                "chart": None,
                "registros": [],
            }

    if any(w in lower for w in ("proveedor", "proveedores", "concentra", "top")):
        raw, tops = _run_tool_and_parse(ctx, "top_proveedores", {"anio": anio, "limite": 8})
        if tops is not None:
            ctx.timing["fast_path"] = True
            return {
                "reply": _format_top_proveedores_reply(tops, anio),
                "sources": [{"tool": "top_proveedores", "preview": raw[:500]}],
                "chart": None,
                "registros": [],
            }

    if any(w in lower for w in ("vencer", "vencimiento", "vencen")):
        dias = 30
        for candidate in (7, 15, 30, 60):
            if str(candidate) in lower:
                dias = candidate
                break
        raw, registros = _run_tool_and_parse(ctx, "contratos_por_vencer", {"anio": anio, "dias": dias})
        if registros is not None:
            ctx.timing["fast_path"] = True
            title = f"### Contratos por vencer ({dias} días) — {anio}\n"
            if not registros:
                reply = f"No hay contratos por vencer en los próximos {dias} días."
            else:
                reply = title + "\n".join(_format_contract_line(r) for r in registros[:10])
            return {
                "reply": reply,
                "sources": [{"tool": "contratos_por_vencer", "preview": raw[:500]}],
                "chart": None,
                "registros": registros,
            }

    if any(w in lower for w in ("panorama", "indicadores", "kpis")) and "modalidad" not in lower:
        ctx.timing["fast_path"] = True
        return {
            "reply": _format_vigencia_snapshot(ctx),
            "sources": [{"tool": "analytics_s2", "preview": "snapshot"}],
            "chart": None,
            "registros": [],
        }

    return None


def _try_fast_text_response(ctx: CopilotRunContext, message: str) -> dict[str, Any] | None:
    if _wants_chart(message) or not _looks_like_contract_query(message):
        return None
    texto = _extract_search_text(message)
    if not texto:
        return None
    raw, registros = _run_tool_and_parse(ctx, "buscar_contratos", {"anio": ctx.anio, "texto": texto, "limite": 10})
    if not registros:
        return None
    ctx.timing["fast_path"] = True
    return {
        "reply": _format_contract_search_reply(texto, registros, ctx.anio),
        "sources": [{"tool": "buscar_contratos", "preview": raw[:500]}],
        "chart": None,
        "registros": registros,
    }


def _llm_available() -> bool:
    return bool(get_api_key_for_feature("secop_copilot"))


_TOOL_FUNCS = {
    "resumen_vigencia": _tool_resumen_vigencia,
    "listar_alertas": _tool_listar_alertas,
    "top_proveedores": _tool_top_proveedores,
    "buscar_contratos": _tool_buscar_contratos,
    "contratos_por_vencer": _tool_contratos_por_vencer,
    "contratos_sin_liquidar": _tool_contratos_sin_liquidar,
    "ejecucion_por_responsable": _tool_ejecucion_por_responsable,
    "serie_mensual": _tool_serie_mensual,
    "por_modalidad": _tool_por_modalidad,
    "generar_grafico": _tool_generar_grafico,
}


def execute_tool(ctx: CopilotRunContext, name: str, arguments: dict) -> str:
    fn = _TOOL_FUNCS.get(name)
    if not fn:
        return json.dumps({"error": f"Herramienta desconocida: {name}"})
    return fn(ctx, arguments)


def run_secop_copilot(
    entity: Entity,
    message: str,
    *,
    anio: int,
    history: list[dict[str, str]] | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    started = time.monotonic()
    ctx = CopilotRunContext(entity, anio)

    fast = _try_fast_chart_response(ctx, message)
    if fast is not None:
        ctx.timing["total_ms"] = int((time.monotonic() - started) * 1000)
        fast["timing"] = ctx.timing
        logger.info(
            "secop_copilot entity=%s anio=%s fast_path=chart timing=%s",
            entity.id,
            anio,
            ctx.timing,
        )
        return fast

    history = history or []

    followup = _try_followup_response(ctx, message, history)
    if followup is not None:
        ctx.timing["total_ms"] = int((time.monotonic() - started) * 1000)
        followup["timing"] = ctx.timing
        logger.info(
            "secop_copilot entity=%s anio=%s fast_path=followup timing=%s",
            entity.id,
            anio,
            ctx.timing,
        )
        return followup

    intent = _try_tool_intent_response(ctx, message)
    if intent is not None:
        ctx.timing["total_ms"] = int((time.monotonic() - started) * 1000)
        intent["timing"] = ctx.timing
        logger.info(
            "secop_copilot entity=%s anio=%s fast_path=intent timing=%s",
            entity.id,
            anio,
            ctx.timing,
        )
        return intent

    fast_text = _try_fast_text_response(ctx, message)
    if fast_text is not None:
        ctx.timing["total_ms"] = int((time.monotonic() - started) * 1000)
        fast_text["timing"] = ctx.timing
        logger.info(
            "secop_copilot entity=%s anio=%s fast_path=text timing=%s",
            entity.id,
            anio,
            ctx.timing,
        )
        return fast_text

    if not _llm_available():
        ctx.timing["total_ms"] = int((time.monotonic() - started) * 1000)
        return {
            "reply": (
                "El copiloto puede responder gráficos, búsqueda de contratos, alertas y resúmenes básicos. "
                "Para preguntas abiertas configure **SECOP_OPENAI_API_KEY** en el servidor."
            ),
            "sources": [],
            "chart": None,
            "registros": [],
            "timing": ctx.timing,
        }
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": _SYSTEM_COPILOT + f" Año de referencia: {anio}."},
        *history[-8:],
        {"role": "user", "content": message},
    ]

    sources: list[dict] = []
    chart: dict | None = None
    registros: list[dict] = []
    reply = ""

    def _llm_call(extra: dict[str, Any] | None = None) -> Any:
        t0 = time.monotonic()
        kwargs: dict[str, Any] = {
            "entity_id": entity.id,
            "user_id": user_id,
            "temperature": 0.3,
        }
        if extra:
            kwargs.update(extra)
        response = chat_completion("secop_copilot", messages, **kwargs)
        ctx.timing["llm_ms"] += int((time.monotonic() - t0) * 1000)
        return response

    try:
        for round_idx in range(MAX_COPILOT_TOOL_ROUNDS):
            response = _llm_call(tools=TOOL_DEFINITIONS, tool_choice="auto")
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
                t0 = time.monotonic()
                result = execute_tool(ctx, tc.function.name, args)
                tool_ms = int((time.monotonic() - t0) * 1000)
                ctx.timing["tools"].append({"name": tc.function.name, "ms": tool_ms})
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
                reply = _llm_call().choices[0].message.content or ""
                break
        else:
            reply = _llm_call().choices[0].message.content or ""
    except Exception as exc:
        logger.exception("secop_copilot LLM error entity=%s anio=%s", entity.id, anio)
        for fallback_fn in (
            lambda: _try_followup_response(ctx, message, history),
            lambda: _try_tool_intent_response(ctx, message),
            lambda: _try_fast_text_response(ctx, message),
        ):
            fallback = fallback_fn()
            if fallback is not None:
                ctx.timing["total_ms"] = int((time.monotonic() - started) * 1000)
                fallback["timing"] = ctx.timing
                fallback["timing"]["llm_error"] = str(exc)[:200]
                return fallback
        reply = (
            "No pude consultar la IA en este momento. "
            "Pruebe preguntas como «contrato de [nombre]», «principales riesgos» o «contratos por vencer»."
        )
        ctx.timing["error"] = str(exc)[:200]

    if chart is None and _wants_chart(message):
        chart = _infer_chart(ctx, message)

    ctx.timing["total_ms"] = int((time.monotonic() - started) * 1000)
    logger.info(
        "secop_copilot entity=%s anio=%s fast_path=false timing=%s tools=%s",
        entity.id,
        anio,
        ctx.timing,
        [s["tool"] for s in sources],
    )
    return {
        "reply": reply,
        "sources": sources,
        "chart": chart,
        "registros": registros,
        "timing": ctx.timing,
    }
