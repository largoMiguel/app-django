"""Narrativa OpenAI para informes PDM institucionales."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


class PdmReportAIService:
    def __init__(self) -> None:
        api_key = getattr(settings, "PQRS_REPORTS_OPENAI_API_KEY", "") or getattr(settings, "OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("OPENAI API key no configurada")
        self.client = OpenAI(api_key=api_key)
        self.model = (
            getattr(settings, "PQRS_REPORTS_OPENAI_MODEL", "")
            or getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
        )

    def analizar_pdm(
        self,
        analytics: dict[str, Any],
        entity_name: str,
        anio: int,
        secretaria_nombre: str | None = None,
    ) -> dict[str, Any]:
        prompt = self._construir_prompt(analytics, entity_name, anio, secretaria_nombre)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un analista experto en gestión pública colombiana "
                        "especializado en Plan de Desarrollo Municipal (PDM). "
                        "Generas informes profesionales, concisos y bien estructurados en español formal."
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
        secretaria_nombre: str | None,
    ) -> str:
        alcance = secretaria_nombre or "toda la entidad territorial"
        estado = analytics.get("estado_distribucion", {})
        pres = analytics.get("presupuesto", {})
        return f"""Analiza la gestión del Plan de Desarrollo Municipal del {entity_name} para la vigencia {anio} ({alcance}).

**INDICADORES:**
• Total productos: {analytics.get('total_productos', 0)}
• Avance físico global: {analytics.get('avance_global', 0)}%
• Productos al 100%: {analytics.get('productos_al_100', 0)}
• Presupuesto pto. definitivo: {pres.get('pto_definitivo', 0):,.0f}
• Pagos ejecutados: {pres.get('pagos', 0):,.0f}
• Pendientes: {estado.get('pendiente', 0)} | En progreso: {estado.get('en_progreso', 0)} | Completados: {estado.get('completado', 0)}

Genera un análisis CONCISO con estas secciones:

1. **CONCLUSIONES** (máximo 200 palabras, 2 párrafos)
2. **RECOMENDACIONES** (exactamente 4 recomendaciones concretas, 2 oraciones cada una)

Inicia directamente con el contenido de cada sección."""

    def _parse_response(self, content: str) -> dict[str, Any]:
        sections: dict[str, Any] = {"conclusiones": "", "recomendaciones": []}
        section_map = {
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
                    if rest:
                        current_lines = [rest]
                    else:
                        current_lines = []
                    break
            if matched:
                if current == "conclusiones" and current_lines:
                    sections["conclusiones"] = " ".join(current_lines).strip()
                elif current == "recomendaciones" and current_lines:
                    sections["recomendaciones"] = [l.strip("-• ") for l in current_lines if l.strip()]
                current = matched
                continue
            if current and stripped:
                current_lines.append(stripped)
        if current == "conclusiones" and current_lines:
            sections["conclusiones"] = " ".join(current_lines).strip()
        elif current == "recomendaciones" and current_lines:
            sections["recomendaciones"] = [l.strip("-• ") for l in current_lines if l.strip()]
        return sections


def build_fallback_analysis(
    analytics: dict[str, Any],
    entity_name: str,
    anio: int,
    secretaria_nombre: str | None = None,
) -> dict[str, Any]:
    alcance = f" de {secretaria_nombre}" if secretaria_nombre else ""
    avance = analytics.get("avance_global", 0)
    total = analytics.get("total_productos", 0)
    al_100 = analytics.get("productos_al_100", 0)
    pres = analytics.get("presupuesto", {})
    pct_fin = 0.0
    if pres.get("pto_definitivo"):
        pct_fin = round((pres.get("pagos", 0) / pres["pto_definitivo"]) * 100, 1)
    return {
        "conclusiones": (
            f"Durante la vigencia {anio}, el {entity_name}{alcance} reportó un avance físico promedio del "
            f"{avance}% sobre {total} productos del plan indicativo, con {al_100} productos al 100% de cumplimiento. "
            f"La ejecución financiera alcanzó el {pct_fin}% de los recursos con pago registrado."
        ),
        "recomendaciones": [
            "Fortalecer el seguimiento mensual a productos con avance inferior al 50%.",
            "Priorizar la programación de actividades en productos marcados como pendientes.",
            "Alinear la ejecución presupuestal con el avance físico de cada producto.",
            "Documentar oportunamente las evidencias de cumplimiento de las actividades programadas.",
        ],
    }
