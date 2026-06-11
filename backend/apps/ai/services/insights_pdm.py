"""Insights IA para el módulo PDM."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from apps.ai.client import chat_completion
from apps.ai.services.pdm_anomalies import detect_pdm_anomalies


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


def generate_pdm_insights(entity_id: int, anio: int | None = None) -> dict[str, Any]:
    """Insights PDM: anomalías por reglas + narrativa IA."""
    if anio is None:
        anio = datetime.now().year

    anomalies = detect_pdm_anomalies(entity_id, anio=anio)
    rule_insights = [_anomaly_to_insight(a) for a in anomalies[:8]]

    ai_insights: list[dict] = []
    try:
        prompt = (
            f"Genera entre 2 y 4 insights breves para dashboard PDM año {anio}.\n"
            f"Anomalías detectadas: {len(anomalies)}.\n"
            f"Top: {[a['title'] for a in anomalies[:4]]}.\n"
            "Formato JSON: {\"insights\": [{\"title\": \"...\", \"text\": \"...\", \"severity\": \"low|medium|high\"}]}"
        )
        response = chat_completion(
            feature="anomaly",
            messages=[{"role": "user", "content": prompt}],
            entity_id=entity_id,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content or "{}")
        for item in data.get("insights", [])[:4]:
            item["source"] = "ai"
            ai_insights.append(item)
    except Exception:  # noqa: BLE001
        pass

    combined = rule_insights + ai_insights
    return {
        "insights": combined[:10],
        "anomalies_count": len(anomalies),
        "anomalies": anomalies[:15],
        "anio": anio,
    }
