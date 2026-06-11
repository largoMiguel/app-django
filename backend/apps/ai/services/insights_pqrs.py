"""Insights IA para el módulo PQRS."""
from __future__ import annotations

import json
from typing import Any

from apps.ai.client import chat_completion
from apps.ai.services.pqrs_compliance import compute_compliance_stats, compute_sla_risk_scores


def _sla_risk_to_insight(risk: dict) -> dict:
    severity = "high" if risk["risk_score"] >= 70 else "medium" if risk["risk_score"] >= 50 else "low"
    return {
        "title": f"Riesgo SLA: {risk['numero_radicado']}",
        "text": "; ".join(risk.get("factors", [])[:2]) or risk.get("asunto", ""),
        "severity": severity,
        "score": risk["risk_score"],
        "source": "rule",
        "metadata": risk,
    }


def _compliance_to_insights(stats: dict[str, Any]) -> list[dict]:
    """Insights derivados de reglas de compliance (sin llamada IA)."""
    insights: list[dict] = []
    if stats["vencidas_abiertas"] > 0:
        insights.append({
            "title": "PQRS vencidas abiertas",
            "text": f"{stats['vencidas_abiertas']} solicitudes abiertas superaron el plazo legal.",
            "severity": "high",
            "score": min(100, stats["vencidas_abiertas"] * 10),
            "source": "rule",
        })
    aging_30 = stats.get("aging", {}).get("30_plus", 0)
    if aging_30 > 0:
        insights.append({
            "title": "Backlog antiguo (+30 días)",
            "text": f"{aging_30} PQRS abiertas con más de 30 días sin resolver.",
            "severity": "medium",
            "score": min(90, aging_30 * 8),
            "source": "rule",
        })
    if stats["total"] > 0 and stats["pct_en_termo"] < 80:
        insights.append({
            "title": "Cumplimiento SLA bajo",
            "text": f"Solo {stats['pct_en_termo']}% de respuestas en término (objetivo ≥80%).",
            "severity": "medium",
            "score": max(30, 100 - int(stats["pct_en_termo"])),
            "source": "rule",
        })
    return insights


def generate_pqrs_insights(entity_id: int, user=None) -> dict[str, Any]:
    """Insights PQRS: reglas SLA + narrativa IA (alcance por rol)."""
    from apps.ai.scoping import pqrs_queryset_for_ai_user

    qs = pqrs_queryset_for_ai_user(user) if user else None
    if qs is not None:
        qs = qs.filter(entity_id=entity_id)
    stats = compute_compliance_stats(entity_id, qs=qs)
    sla_risks = compute_sla_risk_scores(entity_id, qs=qs)
    rule_insights = _compliance_to_insights(stats)
    rule_insights.extend([_sla_risk_to_insight(r) for r in sla_risks[:6] if r["risk_score"] >= 50])

    ai_insights: list[dict] = []
    try:
        prompt = (
            f"Genera entre 2 y 4 insights breves (máx 2 líneas) para dashboard PQRS.\n"
            f"total={stats['total']}, respondidas={stats['respondidas']}, "
            f"pct_en_termo={stats['pct_en_termo']}%, vencidas_abiertas={stats['vencidas_abiertas']}, "
            f"compliance_score={stats['compliance_score']}, aging={stats['aging']}.\n"
            "Formato JSON: {\"insights\": [{\"title\": \"...\", \"text\": \"...\", \"severity\": \"low|medium|high\"}]}"
        )
        response = chat_completion(
            feature="pqrs_compliance",
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
        "stats": stats,
        "sla_risks_count": len([r for r in sla_risks if r["risk_score"] >= 50]),
    }
