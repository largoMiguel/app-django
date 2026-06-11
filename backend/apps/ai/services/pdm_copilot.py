"""Copiloto interno PDM para admin/secretario."""
from __future__ import annotations

import json
import logging
from typing import Any

from apps.entities.models import Entity
from apps.pdm.chat_tools import TOOL_DEFINITIONS, execute_tool

from apps.ai.client import chat_completion

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 4

SYSTEM_PROMPT = """Eres el copiloto interno del Plan de Desarrollo Municipal (PDM) de {entidad}.
Asistes a funcionarios (administradores y secretarios) en el seguimiento del PDM.

CAPACIDADES:
- Consultar productos, metas, actividades, ejecución presupuestal y contratos.
- Identificar productos en riesgo de incumplimiento.
- Explicar brechas entre avance físico y financiero.
- Sugerir actividades y responsables.

REGLAS:
- Solo datos de la entidad {entidad} (entity_id={entity_id}).
- Español colombiano, profesional pero directo.
- Usa herramientas para obtener datos reales; no inventes cifras.
- Cita códigos de producto y fuentes al final.
- Si detectas riesgos, menciónalos con claridad.
"""


def run_pdm_copilot(
    entity: Entity,
    user_message: str,
    history: list[dict[str, str]] | None = None,
    *,
    user_id: int | None = None,
) -> dict[str, Any]:
    """Ejecuta copiloto PDM con tool-calling."""
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT.format(entidad=entity.name, entity_id=entity.id),
        },
    ]
    for turn in (history or [])[-8:]:
        messages.append({"role": turn["role"], "content": turn["content"][:2000]})
    messages.append({"role": "user", "content": user_message[:2000]})

    sources: list[dict[str, str]] = []
    reply = ""

    for _round in range(MAX_TOOL_ROUNDS):
        response = chat_completion(
            feature="pdm_copilot",
            messages=messages,
            entity_id=entity.id,
            user_id=user_id,
            tools=TOOL_DEFINITIONS,
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
                result_str, tool_sources = execute_tool(entity, fn_name, args)
                sources.extend(tool_sources)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result_str[:8000],
                })
            continue

        reply = (msg.content or "").strip()
        break

    if not reply:
        reply = "No pude generar una respuesta. Intenta reformular tu pregunta."

    return {"reply": reply, "sources": sources[:10]}
