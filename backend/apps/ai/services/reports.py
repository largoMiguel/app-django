"""Generación de reportes narrativos con IA."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from apps.ai.client import chat_completion
from apps.ai.services.pdm_anomalies import detect_pdm_anomalies, forecast_pdm_completion
from apps.pdm.analytics import compute_pdm_analytics

logger = logging.getLogger(__name__)


def generate_pdm_narrative_report(entity_id: int, anio: int | None = None) -> dict[str, Any]:
    """Genera informe narrativo del PDM en prosa."""
    if anio is None:
        anio = datetime.now().year

    analytics = compute_pdm_analytics(entity_id, anio=anio)
    anomalies = detect_pdm_anomalies(entity_id, anio=anio)[:10]
    forecasts = forecast_pdm_completion(entity_id, anio=anio)[:10]

    data_summary = {
        "anio": anio,
        "avance_global": analytics.get("avance_global"),
        "productos_al_100": analytics.get("productos_al_100"),
        "estado_distribucion": analytics.get("estado_distribucion"),
        "anomalias_count": len(anomalies),
        "at_risk_count": sum(1 for f in forecasts if f.get("at_risk")),
        "top_anomalies": [a["title"] for a in anomalies[:5]],
    }

    prompt = f"""Genera un informe ejecutivo narrativo del Plan de Desarrollo Municipal para el año {anio}.

DATOS:
{data_summary}

Estructura:
1. Resumen ejecutivo (3-4 líneas)
2. Avance general y cumplimiento de metas
3. Áreas de atención (anomalías detectadas)
4. Productos en riesgo de incumplimiento
5. Recomendaciones (3-5 bullets concretos)

Español formal colombiano. Máximo 600 palabras. No inventes datos."""

    response = chat_completion(
        feature="report",
        messages=[
            {"role": "system", "content": "Eres un analista de gestión pública municipal."},
            {"role": "user", "content": prompt},
        ],
        entity_id=entity_id,
        temperature=0.3,
        metadata={"type": "pdm_narrative", "anio": anio},
    )

    narrative = (response.choices[0].message.content or "").strip()
    return {
        "narrative": narrative,
        "anio": anio,
        "data_summary": data_summary,
        "generated_at": datetime.now().isoformat(),
    }


def generate_pdm_report_pdf(entity_id: int, anio: int | None = None) -> bytes:
    """Genera PDF del informe narrativo PDM."""
    report = generate_pdm_narrative_report(entity_id, anio=anio)
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, f"Informe PDM {report['anio']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 6, report["narrative"])
    return pdf.output()
