"""Servicios de IA para PQRS (OpenAI + extracción de texto)."""
from __future__ import annotations

import io
import json
import logging
import re
from typing import Any

from django.conf import settings
from openai import OpenAI

from apps.entities.models import Secretaria

logger = logging.getLogger(__name__)


# ── Extracción de texto desde adjuntos ────────────────────────────────
def extract_text_from_file(filename: str, content: bytes) -> str:
    """Extrae texto plano del contenido binario de un archivo soportado."""
    name = (filename or "").lower()
    try:
        if name.endswith(".pdf"):
            return _extract_pdf(content)
        if name.endswith(".docx"):
            return _extract_docx(content)
        if name.endswith((".txt", ".md", ".csv", ".log")):
            return content.decode("utf-8", errors="ignore")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Fallo extrayendo texto de %s: %s", filename, exc)
    return ""


def _extract_pdf(content: bytes) -> str:
    """Extrae texto de un PDF. Intenta pdfplumber primero (mejor con tablas/layouts
    complejos), y cae a pypdf como fallback."""
    # ── Intento 1: pdfplumber (mucho mejor con tablas y columnas) ──
    try:
        import pdfplumber
        parts: list[str] = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                try:
                    text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
                    parts.append(text)
                except Exception:  # noqa: BLE001
                    continue
        result = "\n".join(parts).strip()
        if result:
            return result
    except ImportError:
        logger.debug("pdfplumber no instalado; usando pypdf.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("pdfplumber falló (%s); usando pypdf.", exc)

    # ── Intento 2: pypdf (fallback) ──
    try:
        from pypdf import PdfReader
    except ImportError:
        logger.warning("pypdf no instalado; omitiendo PDF.")
        return ""
    reader = PdfReader(io.BytesIO(content))
    parts2: list[str] = []
    for page in reader.pages:
        try:
            parts2.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001
            continue
    return "\n".join(parts2).strip()


def _extract_docx(content: bytes) -> str:
    try:
        from docx import Document
    except ImportError:
        logger.warning("python-docx no instalado; omitiendo DOCX.")
        return ""
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text).strip()


# ── OpenAI ────────────────────────────────────────────────────────────
TIPOS_VALIDOS = [
    "peticion", "queja", "reclamo", "sugerencia", "denuncia",
    "felicitacion", "solicitud_informacion", "copia", "otro",
]
CANALES_RESPUESTA = ["email", "telefono", "fisica", "presencial", "otro"]


def _build_prompt(texto: str, secretarias: list[dict]) -> str:
    secretarias_txt = "\n".join(
        f"- id={s['id']}: {s['nombre']}" for s in secretarias
    ) or "(sin secretarías registradas)"
    return f"""Eres un asistente experto en derecho administrativo colombiano (Ley 1755 de 2015) que clasifica y estructura PQRS (Peticiones, Quejas, Reclamos, Sugerencias y Denuncias).

A partir del siguiente texto del ciudadano (puede incluir contenido extraído de documentos adjuntos), extrae los campos en JSON ESTRICTAMENTE válido (sin texto adicional, sin markdown, sin ```), siguiendo este esquema:

{{
  "tipo_solicitud": "peticion|queja|reclamo|sugerencia|denuncia|felicitacion|solicitud_informacion|copia|otro",
  "asunto": "string corto (máx 100 chars) que resuma la solicitud",
  "descripcion": "string detallado, redactado formalmente como si fuera escrito por el ciudadano",
  "anonimo": true|false,
  "tipo_persona": "natural|juridica",
  "tipo_identificacion": "CC|CE|TI|PA|NIT|null",
  "cedula_ciudadano": "string|null",
  "nombre_ciudadano": "string (nombre completo o razón social)|null",
  "email_ciudadano": "string|null",
  "telefono_ciudadano": "string|null",
  "direccion_ciudadano": "string|null",
  "medio_respuesta": "email|telefono|fisica|presencial",
  "canal_llegada": "web|presencial|email|telefono",
  "secretaria_id": <id numérico de la secretaría más adecuada de la lista, o null>,
  "secretaria_justificacion": "string explicando por qué"
}}

REGLAS:
- anonimo=false si el documento identifica claramente a una entidad (alcaldía, gobernación, empresa, sociedad, fundación, hospital, etc.) con nombre o NIT, O si identifica a una persona natural con nombre, número de documento o datos de contacto. Solo marca anonimo=true cuando el solicitante deliberadamente NO se identifica y no hay ningún dato institucional ni personal.
- tipo_persona=juridica si el solicitante es cualquier entidad pública (alcaldía, gobernación, ministerio, secretaría, hospital público, ICBF, etc.) o privada (empresa, S.A.S., Ltda., cooperativa, fundación, ONG, etc.) o si aparece un NIT. En cualquier otro caso tipo_persona=natural.
- Si tipo_persona=juridica: tipo_identificacion DEBE ser "NIT", nombre_ciudadano es la razón social o nombre de la entidad, y cedula_ciudadano es el NIT (incluye dígito de verificación si aparece, p.ej. "891855138-1").
- Para persona natural: cedula_ciudadano es el número de cédula/documento.
- El asunto es UN RENGLÓN corto. La descripción es completa y formal.
- Si el texto menciona reembolso, daño, mal servicio → "reclamo". Si pide información oficial → "solicitud_informacion". Si denuncia hechos irregulares → "denuncia". Si felicita → "felicitacion". Si propone mejora → "sugerencia". Si presenta inconformidad sin reclamar → "queja". Si pide algo en general → "peticion".
- Selecciona secretaria_id SOLO si claramente coincide con un área de la lista; si no, null.
- medio_respuesta: infiere del texto el canal preferido (email si menciona correo electrónico, telefono si menciona llamada/teléfono, fisica si menciona dirección/correspondencia/carta, presencial si indica que irá en persona). Si no está claro, usa "email".

Secretarías disponibles:
{secretarias_txt}

Texto del ciudadano:
\"\"\"{texto[:15000]}\"\"\"

Responde SOLO con el JSON."""


def _coerce_json(raw: str) -> dict[str, Any]:
    """Extrae el primer bloque JSON válido del string."""
    s = raw.strip()
    # Remover fences ```json ... ```
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    # Tomar desde primer { hasta último }
    a, b = s.find("{"), s.rfind("}")
    if a >= 0 and b > a:
        s = s[a : b + 1]
    return json.loads(s)


def call_openai(prompt: str) -> str:
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY no está configurada.")
    model = getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or ""


def extraer_pqrs_con_ia(texto_usuario: str, archivos: list[tuple[str, bytes]], entity_id: int) -> dict[str, Any]:
    """Combina texto + adjuntos y pide a OpenAI estructurar la PQRS.

    archivos: lista de tuplas (filename, bytes_content).
    """
    bloques = [texto_usuario.strip()] if texto_usuario else []
    for fname, content in archivos:
        extracted = extract_text_from_file(fname, content)
        if extracted:
            bloques.append(f"\n--- Contenido del archivo {fname} ---\n{extracted}")

    if not bloques:
        raise ValueError("No hay texto ni documentos legibles para procesar.")

    texto_completo = "\n".join(bloques)

    secretarias = list(
        Secretaria.objects.filter(entity_id=entity_id, is_active=True)
        .values("id", "nombre")
    )

    prompt = _build_prompt(texto_completo, secretarias)
    raw = call_openai(prompt)
    try:
        data = _coerce_json(raw)
    except Exception as exc:
        logger.error("Respuesta IA no parseable: %s — raw=%s", exc, raw[:500])
        raise ValueError("La IA devolvió una respuesta no parseable.") from exc

    # Normalizar / validar
    tipo = (data.get("tipo_solicitud") or "otro").lower()
    if tipo not in TIPOS_VALIDOS:
        tipo = "otro"
    medio = (data.get("medio_respuesta") or "email").lower()
    if medio not in CANALES_RESPUESTA:
        medio = "email"
    canal = (data.get("canal_llegada") or "web").lower()
    if canal not in ("web", "presencial", "email", "telefono"):
        canal = "web"

    anonimo = bool(data.get("anonimo"))
    # Salvaguarda: si la IA extrajo nombre, NIT o documento, NO puede ser anónimo
    if data.get("nombre_ciudadano") or data.get("cedula_ciudadano"):
        anonimo = False
    sec_id = data.get("secretaria_id")
    if sec_id is not None:
        try:
            sec_id = int(sec_id)
        except (TypeError, ValueError):
            sec_id = None
        if sec_id and not any(s["id"] == sec_id for s in secretarias):
            sec_id = None

    tipo_id = (data.get("tipo_identificacion") or "").upper()
    tipo_persona_raw = (data.get("tipo_persona") or "").lower()
    # Si la IA detectó NIT, forzar juridica; si detectó juridica, forzar NIT
    if tipo_id == "NIT" or tipo_persona_raw == "juridica":
        tipo_persona = "juridica"
        tipo_id = "NIT"
    else:
        tipo_persona = "natural"
        if tipo_id not in ("CC", "CE", "TI", "PA"):
            tipo_id = "CC"

    return {
        "tipo_solicitud": tipo,
        "asunto": (data.get("asunto") or "Solicitud ciudadana")[:200],
        "descripcion": data.get("descripcion") or texto_completo[:3000],
        "anonimo": anonimo,
        "tipo_persona": None if anonimo else tipo_persona,
        "tipo_identificacion": tipo_id if not anonimo else None,
        "cedula_ciudadano": None if anonimo else (data.get("cedula_ciudadano") or None),
        "nombre_ciudadano": None if anonimo else (data.get("nombre_ciudadano") or None),
        "email_ciudadano": None if anonimo else (data.get("email_ciudadano") or None),
        "telefono_ciudadano": None if anonimo else (data.get("telefono_ciudadano") or None),
        "direccion_ciudadano": None if anonimo else (data.get("direccion_ciudadano") or None),
        "medio_respuesta": "otro" if (medio == "email" and not (None if anonimo else (data.get("email_ciudadano") or None))) else medio,
        "canal_llegada": canal,
        "secretaria_id": sec_id,
        "secretaria_justificacion": data.get("secretaria_justificacion") or "",
    }
