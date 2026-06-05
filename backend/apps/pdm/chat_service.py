"""Servicio de chat IA del PDM — OpenAI tool-calling con guardrails."""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any

from django.conf import settings
from openai import OpenAI

from apps.entities.models import Entity

from .chat_tools import ANIOS_PDM, TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 12
MAX_MESSAGE_CHARS = 2000


def _current_year() -> int:
    return datetime.now().year


def _extract_anio_seguimiento(user_message: str, history: list[dict[str, str]] | None) -> int:
    """Infiere el año PDM de la pregunta actual + mensajes recientes."""
    chunks = [user_message]
    for turn in (history or [])[-8:]:
        chunks.append(turn.get("content") or "")
    text = " ".join(chunks)

    years_found = [int(y) for y in re.findall(r"\b(202[4-7])\b", text)]
    if years_found:
        return years_found[-1]

    if re.search(r"\b(este\s+año|año\s+actual|ano\s+actual|el\s+año)\b", text, re.I):
        return _current_year()

    return _current_year()


def _build_system_prompt(
    entity: Entity,
    user_message: str,
    history: list[dict[str, str]] | None,
) -> str:
    plan = entity.plan_name or "Plan de Desarrollo Municipal"
    anio_actual = _current_year()
    anio_seguimiento = _extract_anio_seguimiento(user_message, history)
    anios_pdm = ", ".join(str(y) for y in ANIOS_PDM)

    contexto_conversacion = ""
    if history:
        contexto_conversacion = """
CONVERSACIÓN EN CURSO:
- Mantén el contexto de los mensajes anteriores (año, productos, tema).
- Si el usuario hace seguimiento corto ("¿y el avance financiero?", "¿cuánto se ejecutó?", "¿y las evidencias?"),
  responde en el MISMO marco (mismo año y alcance) que la pregunta previa, sin reiniciar ni listar todo el PDM.
- No repitas información ya dada salvo que el usuario lo pida explícitamente.
"""

    return f"""Eres el asistente virtual oficial del {plan} de {entity.name} (Colombia).

FECHAS Y AÑOS (CRÍTICO):
- Hoy es {anio_actual}. "Este año" / "año actual" = {anio_actual}.
- El PDM solo tiene datos de seguimiento para: {anios_pdm}. NUNCA uses 2023 ni otros años fuera de ese rango.
- Para esta consulta, usa año de seguimiento: {anio_seguimiento} (pásalo siempre como parámetro `anio` en las herramientas).

PROYECTOS Y BPIN (CRÍTICO):
- El código BPIN (Proyecto de Inversión Pública PIIP, ej. 2024157620001, ~13 dígitos) NO es el `codigo_producto` del plan indicativo.
- Si el usuario menciona un BPIN, un "proyecto" o un número largo de inversión: usa `consultar_proyecto_bpin` (no `buscar_productos` ni `detalle_producto`).
- Para listar o explorar proyectos del PDM: usa `listar_proyectos`.
- Los productos del plan indicativo se consultan con `buscar_productos` / `detalle_producto` (códigos como 4.1.1, nombres de producto MGA, etc.).

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE sobre el PDM de {entity.name}. Rechaza otras entidades, otros módulos o temas ajenos al PDM.
2. Usa EXCLUSIVAMENTE datos de las herramientas (tools). NUNCA inventes cifras, fechas, productos ni URLs.
3. Para "metas cumplidas" / "avance del año": usa `metas_cumplidas_anio` con el año correcto.
4. Para avance financiero de un año: usa `ejecucion_presupuestal` con `anio`; resume totales primero; lista máximo 8 productos relevantes.
5. Cita evidencias con URLs cuando existan (url_evidencia, portal BPIN datos.gov.co).
6. Formatea montos en COP con separadores de miles.
7. Responde en español colombiano, claro y accesible.
8. Al final incluye "**Fuentes consultadas:**" con productos, proyectos BPIN o URLs usadas.
{contexto_conversacion}
Contexto de la entidad:
- Nombre: {entity.name}
- Plan: {plan}
- Portal BPIN: https://www.datos.gov.co/Inversi-n/Proyectos-de-Inversi-n-P-blica-BPIN/cf9k-55fw
"""


def _get_client() -> OpenAI:
    api_key = getattr(settings, "PDM_CHAT_OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("PDM_CHAT_OPENAI_API_KEY no está configurada.")
    return OpenAI(api_key=api_key)


def _get_model() -> str:
    return getattr(settings, "PDM_CHAT_MODEL", None) or getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")


def chat_pdm(
    entity: Entity,
    user_message: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    Procesa un mensaje del ciudadano y devuelve {reply, sources}.

    history: lista de {role: user|assistant, content: str} (últimos turnos).
    """
    user_message = (user_message or "").strip()
    if not user_message:
        raise ValueError("El mensaje no puede estar vacío.")
    if len(user_message) > MAX_MESSAGE_CHARS:
        raise ValueError(f"El mensaje no puede superar {MAX_MESSAGE_CHARS} caracteres.")

    client = _get_client()
    model = _get_model()

    messages: list[dict] = [
        {"role": "system", "content": _build_system_prompt(entity, user_message, history)},
    ]

    if history:
        for turn in history[-MAX_HISTORY_TURNS:]:
            role = turn.get("role", "user")
            content = (turn.get("content") or "").strip()
            if content and role in ("user", "assistant"):
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    all_sources: list[dict] = []
    seen_source_keys: set[str] = set()

    for _round in range(MAX_TOOL_ROUNDS):
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            temperature=0.1,
        )
        choice = response.choices[0]
        assistant_msg = choice.message

        if not assistant_msg.tool_calls:
            reply = (assistant_msg.content or "").strip()
            return {
                "reply": reply or "No pude generar una respuesta. Intenta reformular tu pregunta.",
                "sources": _dedupe_sources(all_sources),
            }

        messages.append(assistant_msg.model_dump(exclude_none=True))

        for tool_call in assistant_msg.tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments or "{}")
            except json.JSONDecodeError:
                fn_args = {}

            result_str, sources = execute_tool(entity, fn_name, fn_args)
            for src in sources:
                key = f"{src.get('tipo')}:{src.get('titulo')}:{src.get('url')}"
                if key not in seen_source_keys:
                    seen_source_keys.add(key)
                    all_sources.append(src)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result_str,
            })

    return {
        "reply": "La consulta requirió demasiados pasos. Por favor reformula tu pregunta de forma más específica.",
        "sources": _dedupe_sources(all_sources),
    }


def _dedupe_sources(sources: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for s in sources:
        key = f"{s.get('tipo')}:{s.get('titulo')}:{s.get('url')}"
        if key not in seen:
            seen.add(key)
            out.append(s)
    return out
