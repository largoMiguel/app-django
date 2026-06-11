"""Generación de insights narrativos para dashboards."""
from __future__ import annotations

from typing import Any

from apps.ai.client import chat_completion
from apps.ai.services.pdm_anomalies import detect_pdm_anomalies
from apps.ai.services.pqrs_compliance import compute_compliance_stats


def _anomaly_to_insight(anomaly: dict) -> dict:
    severity = anomaly.get("severity", "medium")
    sev_map = {"high": "high", "medium": "medium", "low": "low"}
    return {
        "title": anomaly.get("title", "Anomalía detectada"),
        "text": anomaly.get("message", ""),
        "severity": sev_map.get(severity, "medium"),
        "score": anomaly.get("score"),
        "source": "rule",
        "metadata": anomaly,
    }


def generate_pqrs_insights(entity_id: int) -> dict[str, Any]:
    """Genera insight narrativo para dashboard PQRS."""
    stats = compute_compliance_stats(entity_id)
    prompt = f"""Genera entre 4 y 6 insights breves (máx 2 líneas cada uno) para el dashboard PQRS.
Datos: total={stats['total']}, respondidas={stats['respondidas']}, 
pct_en_termo={stats['pct_en_termo']}%,
vencidas_abiertas={stats['vencidas_abiertas']},
avg_response_days={stats['avg_response_days']},
compliance_score={stats['compliance_score']},
aging={stats['aging']}.
Formato JSON: {{"insights": [{{"title": "...", "text": "...", "severity": "low|medium|high"}}]}}"""

    response = chat_completion(
        feature="pqrs_compliance",
        messages=[{"role": "user", "content": prompt}],
        entity_id=entity_id,
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    import json
    try:
        data = json.loads(response.choices[0].message.content or "{}")
        insights = data.get("insights", [])
        return {"insights": insights[:6], "stats": stats}
    except json.JSONDecodeError:
        return {"insights": [], "stats": stats}


def generate_pdm_insights(entity_id: int, anio: int | None = None) -> dict[str, Any]:
    """Genera insights narrativos + anomalías detectadas por reglas."""
    from datetime import datetime
    if anio is None:
        anio = datetime.now().year

    anomalies = detect_pdm_anomalies(entity_id, anio=anio)
    rule_insights = [_anomaly_to_insight(a) for a in anomalies[:8]]

    prompt = f"""Genera entre 3 y 5 insights breves para el dashboard PDM año {anio}.
Anomalías detectadas: {len(anomalies)}.
Top anomalías: {[a['title'] for a in anomalies[:6]]}.
Formato JSON: {{"insights": [{{"title": "...", "text": "...", "severity": "low|medium|high"}}]}}"""

    ai_insights: list[dict] = []
    try:
        response = chat_completion(
            feature="anomaly",
            messages=[{"role": "user", "content": prompt}],
            entity_id=entity_id,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        import json
        data = json.loads(response.choices[0].message.content or "{}")
        for item in data.get("insights", [])[:5]:
            item["source"] = "ai"
            ai_insights.append(item)
    except Exception:  # noqa: BLE001
        pass

    # Combinar: primero anomalías por reglas (datos reales), luego narrativa IA
    combined = rule_insights + ai_insights
    return {
        "insights": combined[:10],
        "anomalies_count": len(anomalies),
        "anomalies": anomalies[:15],
    }
