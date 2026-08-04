"""Narrativa OpenAI para informes de Planes Institucionales."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


class PlanesReportAIService:
    def __init__(self) -> None:
        api_key = getattr(settings, "PLANES_REPORTS_OPENAI_API_KEY", "") or getattr(settings, "OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("OPENAI API key no configurada")
        self.client = OpenAI(api_key=api_key)
        self.model = (
            getattr(settings, "PLANES_REPORTS_OPENAI_MODEL", "")
            or getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
        )

    def analizar_planes(
        self,
        analytics: dict[str, Any],
        entity_name: str,
        anio: int,
        trimestre: int,
        trimestre_label: str,
        secretaria_nombre: str | None = None,
    ) -> dict[str, Any]:
        prompt = self._construir_prompt(
            analytics, entity_name, anio, trimestre, trimestre_label, secretaria_nombre
        )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un auditor de control interno experto en gestión pública colombiana "
                        "y en el seguimiento al Decreto 612 de 2018. Generas informes profesionales, "
                        "concisos y bien estructurados en español formal."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=2048,
            temperature=0.7,
        )
        content = response.choices[0].message.content or ""
        return self._parse_response(content)

    def _construir_prompt(
        self,
        analytics: dict[str, Any],
        entity_name: str,
        anio: int,
        trimestre: int,
        trimestre_label: str,
        secretaria_nombre: str | None,
    ) -> str:
        alcance = secretaria_nombre or "toda la entidad territorial"
        por_estado = analytics.get("actividades_por_estado", {})
        por_tri = analytics.get("por_trimestre", [])
        tri_stats = next((t for t in por_tri if t.get("trimestre") == trimestre), {})
        return f"""Analiza el seguimiento a los Planes Institucionales (Decreto 612) de {entity_name} para la vigencia {anio}, {trimestre_label} ({alcance}).

**INDICADORES:**
• Planes D612 creados en vigencia: {analytics.get('planes_d612_creados', 0)} de 12
• Total planes en alcance: {analytics.get('planes_total', 0)}
• Total actividades en alcance: {analytics.get('actividades_total', 0)}
• Avance promedio: {analytics.get('avance_promedio', 0)}%
• Actividades vencidas sin completar: {analytics.get('actividades_vencidas', 0)}
• Planes sin responsable asignado: {analytics.get('planes_sin_responsable', 0)}
• Actividades pendientes: {por_estado.get('PENDIENTE', 0)} | En progreso: {por_estado.get('EN_PROGRESO', 0)} | Completadas: {por_estado.get('COMPLETADA', 0)}
• Trimestre auditado — total actividades: {tri_stats.get('total', 0)} | completadas: {tri_stats.get('completadas', 0)} | avance: {tri_stats.get('avance_promedio', 0)}%
• Actividades sin evidencia: {analytics.get('actividades_sin_evidencia', 0)}

Genera un análisis CONCISO con estas secciones:

1. **RESULTADOS DE LA AUDITORÍA** (máximo 250 palabras, 2-3 párrafos)
2. **CONCLUSIONES** (máximo 150 palabras, 1-2 párrafos)
3. **RECOMENDACIONES** (exactamente 4 recomendaciones concretas, 2 oraciones cada una)

Inicia directamente con el contenido de cada sección."""

    def _parse_response(self, content: str) -> dict[str, Any]:
        sections: dict[str, Any] = {"resultados": "", "conclusiones": "", "recomendaciones": []}
        section_map = {
            "resultados de la auditoría": "resultados",
            "resultados": "resultados",
            "conclusiones": "conclusiones",
            "recomendaciones": "recomendaciones",
        }
        current = None
        current_lines: list[str] = []
        for line in content.split("\n"):
            stripped = line.strip()
            lower = stripped.lower().strip("*# ").rstrip("*")
            matched = None
            for key, field in section_map.items():
                if lower.startswith(key):
                    matched = field
                    rest = stripped.split(":", 1)[-1].strip() if ":" in stripped else ""
                    current_lines = [rest] if rest else []
                    break
            if matched:
                if current == "resultados" and current_lines:
                    sections["resultados"] = " ".join(current_lines).strip()
                elif current == "conclusiones" and current_lines:
                    sections["conclusiones"] = " ".join(current_lines).strip()
                elif current == "recomendaciones" and current_lines:
                    sections["recomendaciones"] = [l.strip("-• ") for l in current_lines if l.strip()]
                current = matched
                continue
            if current and stripped:
                current_lines.append(stripped)
        if current == "resultados" and current_lines:
            sections["resultados"] = " ".join(current_lines).strip()
        elif current == "conclusiones" and current_lines:
            sections["conclusiones"] = " ".join(current_lines).strip()
        elif current == "recomendaciones" and current_lines:
            sections["recomendaciones"] = [l.strip("-• ") for l in current_lines if l.strip()]
        return sections


def build_fallback_analysis(
    analytics: dict[str, Any],
    entity_name: str,
    anio: int,
    trimestre_label: str,
    secretaria_nombre: str | None = None,
) -> dict[str, Any]:
    alcance = f" de {secretaria_nombre}" if secretaria_nombre else ""
    avance = analytics.get("avance_promedio", 0)
    total_act = analytics.get("actividades_total", 0)
    d612 = analytics.get("planes_d612_creados", 0)
    vencidas = analytics.get("actividades_vencidas", 0)
    return {
        "resultados": (
            f"Realizado el seguimiento al cumplimiento de lo establecido por la normatividad vigente "
            f"relacionada con la integración de los planes institucionales al Plan de Acción y el informe "
            f"de gestión del año inmediatamente anterior. En la vigencia {anio}{alcance}, {entity_name} "
            f"registró {d612} de los 12 planes del Decreto 612, con {total_act} actividades en el "
            f"{trimestre_label} y un avance promedio del {avance}%. Se identificaron {vencidas} "
            f"actividades vencidas sin completar."
        ),
        "conclusiones": (
            f"El {entity_name} avanza en la implementación del Decreto 612 de 2018, aunque persisten "
            f"brechas en la cobertura de los 12 planes obligatorios y en el registro oportuno de evidencias. "
            f"El avance del {trimestre_label} refleja oportunidades de mejora en la programación y el "
            f"seguimiento trimestral."
        ),
        "recomendaciones": [
            "Completar la creación e integración de los planes faltantes del catálogo Decreto 612 en el Plan de Acción.",
            "Asignar responsables a los planes que aún no tienen secretaría definida.",
            "Actualizar oportunamente el avance y las evidencias de las actividades del trimestre.",
            "Publicar el informe de gestión del año anterior conforme al artículo 74 de la Ley 1474 de 2011.",
        ],
    }
