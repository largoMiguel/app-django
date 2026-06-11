"""Generación de borradores de respuesta PQRS con IA."""
from __future__ import annotations

import logging
from typing import Any

from apps.pqrs.models import PQRS, TipoSolicitud
from apps.pqrs.services.ai import extract_text_from_file

from apps.ai.client import chat_completion

logger = logging.getLogger(__name__)

TIPO_NORMATIVA = {
    TipoSolicitud.PETICION: "Art. 14 Ley 1755/2015 — derecho de petición",
    TipoSolicitud.QUEJA: "Art. 14 Ley 1755/2015 — queja por conducta irregular",
    TipoSolicitud.RECLAMO: "Art. 14 Ley 1755/2015 — reclamo por prestación indebida",
    TipoSolicitud.SUGERENCIA: "Art. 14 Ley 1755/2015 — sugerencia de mejora",
    TipoSolicitud.DENUNCIA: "Art. 14 Ley 1755/2015 — denuncia de acto irregular",
    TipoSolicitud.FELICITACION: "Art. 14 Ley 1755/2015 — felicitación",
    TipoSolicitud.SOLICITUD_INFORMACION: "Art. 14 Ley 1755/2015 — solicitud de información pública",
    TipoSolicitud.COPIA: "Art. 14 Ley 1755/2015 — solicitud de copias de documentos",
    TipoSolicitud.OTRO: "Art. 14 Ley 1755/2015",
}

PROMPT_DRAFT = """Eres un asistente legal de una entidad pública colombiana.
Genera un BORRADOR de respuesta formal a una PQRS conforme a la Ley 1755 de 2015.

REGLAS:
- Español formal colombiano, tono institucional respetuoso.
- Estructura: saludo → referencia al radicado → análisis del caso → respuesta concreta → normativa aplicable → cierre.
- NO inventes datos, hechos o decisiones que no estén en la solicitud.
- Si falta información para responder completamente, indica qué se necesita.
- Cita la normativa aplicable cuando sea pertinente.
- Máximo 800 palabras.
- El borrador es una PROPUESTA que el funcionario editará antes de enviar.

DATOS DE LA PQRS:
- Radicado: {numero_radicado}
- Tipo: {tipo_solicitud}
- Asunto: {asunto}
- Descripción del ciudadano: {descripcion}
- Normativa base: {normativa}
- Entidad: {entidad}
- Secretaría asignada: {secretaria}
- Texto de adjuntos (si hay): {adjuntos_texto}

Genera SOLO el texto del borrador de respuesta, sin metadatos JSON."""


def _extract_archivos_text(pqrs: PQRS) -> str:
    """Extrae texto de archivos adjuntos de la PQRS."""
    parts: list[str] = []
    for archivo in pqrs.archivos.all()[:4]:
        try:
            archivo.archivo.open("rb")
            content = archivo.archivo.read()
            archivo.archivo.close()
            text = extract_text_from_file(archivo.nombre_original or "", content)
            if text:
                parts.append(f"[{archivo.nombre_original}]: {text[:2000]}")
        except Exception as exc:  # noqa: BLE001
            logger.warning("No se pudo leer archivo %s: %s", archivo.id, exc)
    return "\n".join(parts) if parts else "Sin adjuntos con texto extraíble."


def generate_pqrs_draft(
    pqrs: PQRS,
    *,
    user_id: int | None = None,
    extra_context: str = "",
) -> dict[str, Any]:
    """Genera borrador de respuesta para una PQRS."""
    tipo = pqrs.tipo_solicitud or TipoSolicitud.OTRO
    normativa = TIPO_NORMATIVA.get(tipo, TIPO_NORMATIVA[TipoSolicitud.OTRO])
    adjuntos_texto = _extract_archivos_text(pqrs)

    prompt = PROMPT_DRAFT.format(
        numero_radicado=pqrs.numero_radicado,
        tipo_solicitud=tipo,
        asunto=pqrs.asunto or "",
        descripcion=pqrs.descripcion or "",
        normativa=normativa,
        entidad=pqrs.entity.name if pqrs.entity else "",
        secretaria=pqrs.assigned_to.nombre if pqrs.assigned_to else "No asignada",
        adjuntos_texto=adjuntos_texto,
    )
    if extra_context:
        prompt += f"\n\nContexto adicional del funcionario: {extra_context}"

    response = chat_completion(
        feature="pqrs_draft",
        messages=[
            {"role": "system", "content": "Eres un asistente legal experto en Ley 1755 de Colombia."},
            {"role": "user", "content": prompt},
        ],
        entity_id=pqrs.entity_id,
        user_id=user_id,
        temperature=0.2,
        metadata={"pqrs_id": pqrs.id},
    )

    draft = (response.choices[0].message.content or "").strip()
    return {
        "draft": draft,
        "tipo_solicitud": tipo,
        "normativa": normativa,
        "model": response.model,
    }
