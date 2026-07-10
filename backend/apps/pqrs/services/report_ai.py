"""Narrativa OpenAI para informes PQRS institucionales."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


class PQRSReportAIService:
    def __init__(self) -> None:
        api_key = getattr(settings, "PQRS_REPORTS_OPENAI_API_KEY", "") or getattr(
            settings, "OPENAI_API_KEY", ""
        )
        if not api_key:
            raise ValueError("PQRS_REPORTS_OPENAI_API_KEY no configurada")
        self.client = OpenAI(api_key=api_key)
        self.model = (
            getattr(settings, "PQRS_REPORTS_OPENAI_MODEL", "")
            or getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")
        )

    def analizar_pqrs(
        self,
        analytics: dict[str, Any],
        entity_name: str,
        fecha_inicio: str,
        fecha_fin: str,
        pqrs_list: list[dict] | None = None,
    ) -> dict[str, Any]:
        del pqrs_list
        prompt = self._construir_prompt(analytics, entity_name, fecha_inicio, fecha_fin)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un analista experto en gestión pública colombiana "
                        "especializado en PQRS. Generas informes profesionales, "
                        "concisos y bien estructurados en español formal."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=4096,
            temperature=0.7,
        )
        content = response.choices[0].message.content or ""
        return self._parse_response(content)

    def _construir_prompt(
        self,
        analytics: dict[str, Any],
        entity_name: str,
        fecha_inicio: str,
        fecha_fin: str,
    ) -> str:
        tipos_str = "\n".join(
            f"  • {tipo.replace('_', ' ').title()}: {cant}"
            for tipo, cant in analytics.get("tiposPqrs", {}).items()
        )
        indicadores_lines = [
            f"• Total PQRS: {analytics.get('totalPqrs', 0)}",
            f"• Pendientes: {analytics.get('pendientes', 0)}",
        ]
        if analytics.get("enProceso", 0) > 0:
            indicadores_lines.append(f"• En proceso: {analytics.get('enProceso', 0)}")
        indicadores_lines.append(f"• Respondidas: {analytics.get('resueltas', 0)}")
        if analytics.get("cerradas", 0) > 0:
            indicadores_lines.append(f"• Cerradas: {analytics.get('cerradas', 0)}")
        indicadores_lines.append(f"• Tasa resolución: {analytics.get('tasaResolucion', 0)}%")
        tiempo = analytics.get("tiempoPromedioRespuesta", 0)
        if tiempo > 0:
            indicadores_lines.append(f"• Tiempo promedio respuesta: {tiempo} días")
        indicadores_str = "\n".join(indicadores_lines)

        return f"""Analiza los datos de PQRS del {entity_name} para el período {fecha_inicio} a {fecha_fin}:

**INDICADORES CLAVE:**
{indicadores_str}

**DISTRIBUCIÓN POR TIPO:**
{tipos_str}

Genera un análisis profesional CONCISO con las siguientes secciones:

1. **INTRODUCCIÓN EJECUTIVA** (exactamente 200 palabras, 3 párrafos)
2. **ANÁLISIS GENERAL** (máximo 200 palabras)
3. **ANÁLISIS DE TIEMPOS DE RESPUESTA** (máximo 100 palabras)
4. **RECOMENDACIONES** (exactamente 4 recomendaciones concretas, 2-3 oraciones cada una)
5. **CONCLUSIONES** (máximo 150 palabras, 2 párrafos)

Inicia directamente con el contenido de cada sección."""

    def _parse_response(self, content: str) -> dict[str, Any]:
        sections: dict[str, Any] = {
            "introduccion": "",
            "analisisGeneral": "",
            "analisisTiempos": "",
            "recomendaciones": [],
            "conclusiones": "",
        }
        section_map = {
            "introducción ejecutiva": "introduccion",
            "introduccion ejecutiva": "introduccion",
            "análisis general": "analisisGeneral",
            "analisis general": "analisisGeneral",
            "análisis de tiempos": "analisisTiempos",
            "analisis de tiempos": "analisisTiempos",
            "tiempos de respuesta": "analisisTiempos",
            "recomendaciones": "recomendaciones",
            "conclusiones": "conclusiones",
        }
        current_section = None
        current_text: list[str] = []
        for line in content.split("\n"):
            raw = line.strip()
            is_header = (
                raw.startswith("#")
                or (raw.startswith("**") and len(raw) < 80)
                or (raw.isupper() and 3 < len(raw) < 80)
            )
            line_lower = raw.lower().lstrip("#*123456789. ")
            matched = None
            if is_header:
                for key, val in section_map.items():
                    if key in line_lower:
                        matched = val
                        break
            if matched:
                if current_section and current_text:
                    self._save_section(sections, current_section, current_text)
                current_section = matched
                current_text = []
            elif current_section and raw:
                current_text.append(raw)
        if current_section and current_text:
            self._save_section(sections, current_section, current_text)
        return sections

    def _save_section(self, sections: dict[str, Any], section_name: str, text_lines: list[str]) -> None:
        if section_name == "recomendaciones":
            sections[section_name] = [line.strip() for line in text_lines if line.strip()]
        else:
            sections[section_name] = "\n".join(line.strip() for line in text_lines if line.strip())


def build_fallback_analysis(
    analytics: dict[str, Any],
    entity_name: str,
    fecha_inicio: str,
    fecha_fin: str,
) -> dict[str, Any]:
    total = analytics.get("totalPqrs", 0)
    pendientes = analytics.get("pendientes", 0)
    en_proceso = analytics.get("enProceso", 0)
    resueltas = analytics.get("resueltas", 0)
    cerradas = analytics.get("cerradas", 0)
    tiempo_promedio = analytics.get("tiempoPromedioRespuesta", 0)
    tipos_ordenados = sorted(analytics.get("tiposPqrs", {}).items(), key=lambda x: x[1], reverse=True)
    tipo_principal = tipos_ordenados[0] if tipos_ordenados else ("N/A", 0)

    return {
        "introduccion": (
            f"El presente informe corresponde a la gestión de Peticiones, Quejas, Reclamos, Solicitudes y Denuncias (PQRS) "
            f"del {entity_name} durante el período comprendido entre {fecha_inicio} y {fecha_fin}. "
            f"Durante este período se registró un total de {total} solicitudes ciudadanas."
        ),
        "analisisGeneral": (
            f"Durante el período analizado se registraron {total} PQRS, alcanzando una tasa de resolución del "
            f"{analytics.get('tasaResolucion', 0):.1f}%. Del total, {pendientes} se encuentran pendientes, "
            f"{en_proceso} en proceso, {resueltas} respondidas y {cerradas} cerradas."
        ),
        "analisisTendencias": (
            f"El tipo de solicitud más frecuente corresponde a {tipo_principal[0].replace('_', ' ').title()} "
            f"con {tipo_principal[1]} casos."
        ),
        "analisisTiempos": (
            f"El tiempo promedio de respuesta registrado fue de {tiempo_promedio:.1f} días. "
            f"De acuerdo con la Ley 1755 de 2015, el término legal general es de 15 días hábiles."
        ),
        "recomendaciones": [
            "Implementar seguimiento periódico de PQRS con alertas de vencimiento.",
            "Revisar procesos internos para identificar cuellos de botella.",
            "Fortalecer canales de atención ciudadana presencial, virtual y telefónico.",
            "Desarrollar un tablero de indicadores de gestión en tiempo real.",
        ],
        "conclusiones": (
            f"La gestión de PQRS del {entity_name} durante el período analizado demuestra el compromiso "
            f"institucional con la atención ciudadana, con {total} PQRS gestionadas y una tasa de resolución "
            f"del {analytics.get('tasaResolucion', 0):.1f}%."
        ),
    }
