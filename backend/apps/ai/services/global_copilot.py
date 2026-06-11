"""Copiloto global que cruza PDM + PQRS."""
from __future__ import annotations

import json
import logging
from typing import Any

from apps.entities.models import Entity
from apps.pdm.chat_tools import TOOL_DEFINITIONS as PDM_TOOLS, execute_tool

from apps.ai.client import chat_completion
from apps.ai.services.pdm_anomalies import detect_pdm_anomalies
from apps.ai.services.pqrs_compliance import compute_compliance_stats, compute_sla_risk_scores

logger = logging.getLogger(__name__)

PQRS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "pqrs_compliance",
            "description": "Obtiene métricas de cumplimiento SLA y compliance de PQRS de la entidad.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "pqrs_sla_risks",
            "description": "Lista PQRS abiertas con score de riesgo SLA (0-100).",
            "parameters": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "description": "Máximo de resultados"}},
                "required": [],
            },
        },
    },
]

PDM_ANOMALY_TOOL = {
    "type": "function",
    "function": {
        "name": "pdm_anomalies",
        "description": "Detecta anomalías en el PDM (divergencias, metas sin actividades, etc.).",
        "parameters": {
            "type": "object",
            "properties": {"anio": {"type": "integer", "description": "Año de seguimiento"}},
            "required": [],
        },
    },
}


def _tools_for_entity(entity: Entity) -> list:
    """Herramientas según módulos activos de la entidad."""
    tools: list = []
    if entity.enable_pqrs:
        tools.extend(PQRS_TOOLS)
    if entity.enable_pdm:
        tools.append(PDM_ANOMALY_TOOL)
        tools.extend(PDM_TOOLS)
    return tools


def _system_prompt(entity: Entity) -> str:
    parts = [f"Eres el copiloto inteligente de SoftOne para {entity.name}."]
    if entity.enable_pqrs:
        parts.append(
            "Puedes consultar el módulo PQRS (cumplimiento SLA, riesgos, radicados)."
        )
    if entity.enable_pdm:
        parts.append(
            "Puedes consultar el Plan de Desarrollo Municipal (productos, ejecución, anomalías)."
        )
    if entity.enable_pqrs and entity.enable_pdm:
        parts.append(
            "Cruza información cuando sea útil (ej. quejas de infraestructura vs productos atrasados)."
        )
    parts.append("Español colombiano, profesional. Usa herramientas para datos reales.")
    return " ".join(parts)


def _execute_global_tool(entity: Entity, name: str, args: dict) -> tuple[str, list]:
    if name in ("pqrs_compliance", "pqrs_sla_risks") and not entity.enable_pqrs:
        return json.dumps({"error": "Módulo PQRS no habilitado para esta entidad."}), []
    if name == "pqrs_compliance":
        return json.dumps(compute_compliance_stats(entity.id), ensure_ascii=False, default=str), []
    if name == "pqrs_sla_risks":
        limit = args.get("limit", 10)
        return json.dumps(compute_sla_risk_scores(entity.id)[:limit], ensure_ascii=False, default=str), []
    if name == "pdm_anomalies" and not entity.enable_pdm:
        return json.dumps({"error": "Módulo PDM no habilitado para esta entidad."}), []
    if name == "pdm_anomalies":
        return json.dumps(detect_pdm_anomalies(entity.id, anio=args.get("anio")), ensure_ascii=False, default=str), []
    if not entity.enable_pdm:
        return json.dumps({"error": "Módulo PDM no habilitado para esta entidad."}), []
    return execute_tool(entity, name, args)


def run_global_copilot(
    entity: Entity,
    user_message: str,
    history: list[dict[str, str]] | None = None,
    *,
    user_id: int | None = None,
) -> dict[str, Any]:
    """Copiloto limitado a los módulos activos de la entidad."""
    tools = _tools_for_entity(entity)
    if not tools:
        return {
            "reply": "La entidad no tiene módulos con copiloto IA habilitados (PQRS o PDM).",
            "sources": [],
        }

    messages: list[dict[str, Any]] = [{"role": "system", "content": _system_prompt(entity)}]
    for turn in (history or [])[-8:]:
        messages.append({"role": turn["role"], "content": turn["content"][:2000]})
    messages.append({"role": "user", "content": user_message[:2000]})

    sources: list[dict[str, str]] = []
    reply = ""

    for _round in range(4):
        response = chat_completion(
            feature="global_copilot",
            messages=messages,
            entity_id=entity.id,
            user_id=user_id,
            tools=tools,
            tool_choice="auto",
            temperature=0.2,
        )
        choice = response.choices[0]
        msg = choice.message

        if msg.tool_calls:
            messages.append(msg.model_dump(exclude_none=True))
            for tool_call in msg.tool_calls:
                fn_name = tool_call.function.name
                try:
                    args = json.loads(tool_call.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                result_str, tool_sources = _execute_global_tool(entity, fn_name, args)
                sources.extend(tool_sources)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result_str[:8000],
                })
            continue

        reply = (msg.content or "").strip()
        break

    return {"reply": reply or "No pude generar respuesta.", "sources": sources[:10]}
