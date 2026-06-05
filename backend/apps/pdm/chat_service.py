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


def _classify_response_style(user_message: str, history: list[dict[str, str]] | None) -> str:
    """Infiere el nivel de detalle que espera el ciudadano."""
    chunks = [user_message]
    for turn in (history or [])[-4:]:
        if turn.get("role") == "user":
            chunks.append(turn.get("content") or "")
    text = " ".join(chunks).lower()

    if re.search(
        r"\b(cu[aá]nt[oa]s?|n[uú]mero de|total de|cu[aá]ntas metas|cu[aá]ntos productos)\b",
        text,
    ):
        return "conteo"

    if re.search(
        r"\b(detalle|detalla|espec[ií]fic|lista completa|mu[eé]strame todo|"
        r"todos los|todas las|completo|desglose|uno por uno|actividades de|"
        r"m[aá]s detalle|ampl[ií]a|ver todo|el primero|el segundo)\b",
        text,
    ):
        return "detalle"

    if re.search(
        r"\b(qu[eé] hay|qu[eé] tiene|en (salud|educaci[oó]n|vivienda|agua|"
        r"cultura|deporte|ambiente|infraestructura|seguridad|turismo)|"
        r"resumen|panorama|cu[eé]ntame|hablame de|productos de|metas de)\b",
        text,
    ):
        return "resumen"

    if re.search(r"\b(s[ií]|no)\s*\?|^(s[ií]|no)\.?$", text.strip()):
        return "breve"

    return "equilibrado"


def _build_response_style_prompt(style: str) -> str:
    """Instrucciones de formato según la intención detectada."""
    common = """
ESTILO Y TONO (SIEMPRE):
- Español colombiano, cercano y claro. Evita jerga técnica innecesaria.
- Usa encabezados cortos (##) solo cuando ayuden; no sobrecargues con secciones.
- Montos en COP con separadores de miles (ej. $196.260.000).
- Si hay más datos disponibles, cierra con UNA frase invitando a profundizar
  (ej. "¿Quieres el detalle de algún producto o ver todas las actividades?").
- "**Fuentes consultadas:**" al final, breve (máx. 5 ítems).
"""
    styles = {
        "conteo": """
FORMATO DE RESPUESTA — CONTEO (prioridad máxima):
- Responde PRIMERO con el número en una frase directa. Ejemplo:
  "**Para 2026 hay 47 metas programadas** en el PDM de {entidad}."
- Luego, SOLO si aporta contexto, 2-3 bullets opcionales (ej. completadas vs pendientes).
- NO listes productos uno por uno salvo que lo pidan.
- Máximo 4-6 líneas de cuerpo antes de fuentes.
""",
        "resumen": """
FORMATO DE RESPUESTA — RESUMEN EXPLORATORIO:
- Empieza con 1-2 frases que respondan la pregunta (ej. sector, tema, año).
- Incluye cifras clave: cuántos productos/metas, avance general si aplica.
- Destaca solo 3-5 ítems RELEVANTES (nombre corto + meta o avance + estado).
- NO vuelques tablas largas ni todos los productos del sector.
- Si preguntan por un sector (salud, educación…): usa buscar_productos o
  metas_cumplidas_anio con filtro sector/query; menciona actividades destacadas
  solo si hay 1-2 completadas o en progreso relevantes.
- Ofrece ampliar: "Puedo mostrarte el detalle de uno o la lista completa."
""",
        "detalle": """
FORMATO DE RESPUESTA — DETALLE COMPLETO:
- El usuario pidió profundidad: muestra la información estructurada.
- Usa secciones: Meta y avance | Actividades | Ejecución | Contratos (según aplique).
- Lista actividades, contratos o productos cuando corresponda.
- Mantén párrafos cortos; bullets para listas largas.
""",
        "breve": """
FORMATO DE RESPUESTA — BREVE:
- 1-3 oraciones. Directo al grano.
""",
        "equilibrado": """
FORMATO DE RESPUESTA — EQUILIBRADO:
- Primera línea: respuesta directa a lo preguntado.
- Cuerpo: lo esencial (meta, avance, monto) sin listar todo el PDM.
- Si la pregunta es sobre UN elemento (producto, contrato, BPIN): 1 bloque
  estructurado con lo más importante; detalle extenso solo si lo piden.
- Máximo ~8 bullets o equivalente antes de fuentes.
""",
    }
    return common + styles.get(style, styles["equilibrado"])


def _build_system_prompt(
    entity: Entity,
    user_message: str,
    history: list[dict[str, str]] | None,
) -> str:
    plan = entity.plan_name or "Plan de Desarrollo Municipal"
    anio_actual = _current_year()
    anio_seguimiento = _extract_anio_seguimiento(user_message, history)
    anios_pdm = ", ".join(str(y) for y in ANIOS_PDM)
    response_style = _classify_response_style(user_message, history)
    estilo_respuesta = _build_response_style_prompt(response_style).replace(
        "{entidad}", entity.name
    )

    contexto_conversacion = ""
    if history:
        contexto_conversacion = """
CONVERSACIÓN EN CURSO:
- Mantén el contexto de los mensajes anteriores (año, productos, BPIN, contratos, contratistas, tema).
- Si el usuario hace seguimiento corto ("¿y el avance financiero?", "¿cuánto se ejecutó?", "¿en qué meta está?",
  "¿qué productos tiene?", "¿y las evidencias?"), responde en el MISMO marco (mismo año, entidad consultada)
  que la pregunta previa, sin reiniciar ni listar todo el PDM.
- Si dice "ese contrato", "ese producto", "ese BPIN", "ese proyecto" o similar: extrae del historial reciente
  el contratista, CRP, codigo_producto, BPIN o nombre y consulta con la herramienta adecuada ANTES de responder.
- Si tras un resumen pide "más detalle", "el primero", "lista completa", "actividades" o "todo": cambia a
  formato DETALLE y muestra la información ampliada que pide.
- No repitas información ya dada salvo que el usuario lo pida explícitamente.
- NUNCA digas que no hay información sin haber ejecutado al menos una herramienta de búsqueda relevante.
"""

    return f"""Eres el asistente virtual oficial del {plan} de {entity.name} (Colombia).

FECHAS Y AÑOS (CRÍTICO):
- Hoy es {anio_actual}. "Este año" / "año actual" = {anio_actual}.
- El PDM solo tiene datos de seguimiento para: {anios_pdm}. NUNCA uses 2023 ni otros años fuera de ese rango.
- Para esta consulta, usa año de seguimiento: {anio_seguimiento} (pásalo siempre como parámetro `anio` en las herramientas).

GUÍA DE HERRAMIENTAS (elige la correcta):
| Pregunta del ciudadano | Herramienta |
| BPIN, proyecto PIIP, número ~13 dígitos (20…) | consultar_proyecto_bpin |
| Listar/explorar proyectos del plan | listar_proyectos |
| Buscar productos por nombre, sector, línea, ODS | buscar_productos |
| Detalle de UN producto (meta, actividades, contratos) | detalle_producto |
| Contrato, contratista, CRP, "en qué meta está el contrato" | contratos |
| Metas cumplidas / avance físico general del año | metas_cumplidas_anio |
| Avance financiero / pagos / ejecución presupuestal | ejecucion_presupuestal |
| Actividades y evidencias de un producto | actividades |
| Iniciativas SGR | iniciativas_sgr |
| Panorama general del PDM | resumen_pdm |

PRODUCTOS vs BPIN vs CONTRATOS (CRÍTICO):
- codigo_producto del plan (ej. 2201028, 4.1.1) ≠ BPIN de proyecto PIIP (ej. 2024157620018, ~13 dígitos).
- BPIN → consultar_proyecto_bpin o listar_proyectos. Nunca buscar_productos con un BPIN.
- Contratista o contrato → contratos. Nunca buscar_productos con nombre de contratista.
- Si buscar_productos devuelve sugerencia de BPIN, sigue con consultar_proyecto_bpin.

CONTRATOS Y METAS:
- Cada contrato RPS está vinculado a un codigo_producto; la meta del contrato es la meta de ese producto.
- Si contratos devuelve producto_vinculado, responde con código, nombre, línea estratégica, meta del año y valor.

PRODUCTOS Y SEGUIMIENTO:
- buscar_productos encuentra candidatos; detalle_producto profundiza en uno solo.
- detalle_producto acepta codigo_producto o query (nombre del historial).
- Para meta/avance de un producto concreto: detalle_producto o buscar_productos, no metas_cumplidas_anio solo.

PROYECTOS BPIN:
- consultar_proyecto_bpin devuelve productos_vinculados con meta_anio, contratos_vinculados y datos PIIP.
- Si el usuario pregunta por "ese BPIN" o "ese proyecto", extrae el código del historial.

EJEMPLOS DE ESTILO (imita este patrón):
- "¿Cuántas metas hay para 2026?" → metas_cumplidas_anio(2026). Responde: "**Para 2026 hay 47 productos con meta.**" + 1 línea de contexto. Nada más.
- "¿Qué hay en salud?" → metas_cumplidas_anio(anio, sector="salud") o buscar_productos(sector="salud").
  Resumen: total + 3-5 productos destacados + 1-2 actividades relevantes si existen. Sin listar todo.
- "Detalle del producto de alimentación escolar" → detalle_producto(query=...). Ahí sí, secciones completas.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE sobre el PDM de {entity.name}. Rechaza otras entidades, otros módulos o temas ajenos al PDM.
2. Usa EXCLUSIVAMENTE datos de las herramientas (tools). NUNCA inventes cifras, fechas, productos ni URLs.
3. Para cumplimiento general del año (sin producto específico): metas_cumplidas_anio. Para UN producto: detalle_producto o buscar_productos.
4. Para avance financiero de un año: ejecucion_presupuestal con anio; si es de un producto, pasa codigo_producto o query.
5. Cita evidencias con URLs cuando existan (url_evidencia, portal BPIN datos.gov.co).
6. ADAPTA la longitud y estructura al tipo de pregunta (ver FORMATO DE RESPUESTA abajo).
7. Pregunta general ("¿qué hay en salud?") → resumen + lo relevante. Pregunta numérica
   ("¿cuántas metas?") → número primero. Pide "detalle", "específico" o "todo" → respuesta completa.
{estilo_respuesta}
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
