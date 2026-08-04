"""Gráficas matplotlib para informes PDM."""
from __future__ import annotations

from io import BytesIO
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams["font.family"] = "DejaVu Sans"

_ESTADO_COLORS = {
    "pendiente": "#94a3b8",
    "en_progreso": "#3b82f6",
    "completado": "#22c55e",
    "por_ejecutar": "#f59e0b",
}
_ESTADO_LABELS = {
    "pendiente": "Pendiente",
    "en_progreso": "En progreso",
    "completado": "Completado",
    "por_ejecutar": "Por ejecutar",
}


def _save_fig(fig) -> BytesIO:
    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight", facecolor="white")
    buf.seek(0)
    plt.close(fig)
    return buf


def chart_estado_dona(estado_distribucion: dict[str, int]) -> BytesIO | None:
    labels, values, colors = [], [], []
    for key, color in _ESTADO_COLORS.items():
        val = int(estado_distribucion.get(key, 0))
        if val > 0:
            labels.append(_ESTADO_LABELS[key])
            values.append(val)
            colors.append(color)
    if not values:
        return None
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.pie(values, labels=labels, colors=colors, autopct="%1.0f%%", startangle=90, textprops={"fontsize": 9})
    ax.set_title("Distribución de estados", fontsize=11, fontweight="bold")
    return _save_fig(fig)


def chart_barras_horizontales(
    items: list[dict[str, Any]],
    label_key: str,
    value_key: str,
    title: str,
    xlabel: str = "Avance (%)",
    max_items: int = 12,
) -> BytesIO | None:
    if not items:
        return None
    rows = sorted(items, key=lambda x: float(x.get(value_key, 0)), reverse=True)[:max_items]
    labels = [str(r.get(label_key, ""))[:45] for r in rows]
    values = [float(r.get(value_key, 0)) for r in rows]
    fig, ax = plt.subplots(figsize=(7, max(3, len(labels) * 0.45)))
    y_pos = range(len(labels))
    ax.barh(list(y_pos), values, color="#3eafd4")
    ax.set_yticks(list(y_pos))
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_xlabel(xlabel, fontsize=9)
    ax.set_title(title, fontsize=11, fontweight="bold")
    ax.set_xlim(0, max(100, max(values) * 1.1) if values else 100)
    ax.invert_yaxis()
    fig.tight_layout()
    return _save_fig(fig)


def chart_presupuestal_por_anio(presupuestal_por_anio: list[dict[str, Any]]) -> BytesIO | None:
    if not presupuestal_por_anio:
        return None
    anios = [str(r.get("anio", "")) for r in presupuestal_por_anio]
    plan = [float(r.get("plan", 0)) / 1e6 for r in presupuestal_por_anio]
    ejec = [float(r.get("ejecucion", 0)) / 1e6 for r in presupuestal_por_anio]
    pagos = [float(r.get("pagos", 0)) / 1e6 for r in presupuestal_por_anio]
    x = range(len(anios))
    width = 0.25
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar([i - width for i in x], plan, width, label="Plan", color="#94a3b8")
    ax.bar(list(x), ejec, width, label="Pto. definitivo", color="#3b82f6")
    ax.bar([i + width for i in x], pagos, width, label="Pagos", color="#22c55e")
    ax.set_xticks(list(x))
    ax.set_xticklabels(anios)
    ax.set_ylabel("Millones COP", fontsize=9)
    ax.set_title("Ejecución presupuestal por vigencia", fontsize=11, fontweight="bold")
    ax.legend(fontsize=8)
    fig.tight_layout()
    return _save_fig(fig)


def generate_pdm_charts(analytics: dict[str, Any]) -> dict[str, BytesIO]:
    charts: dict[str, BytesIO] = {}
    dona = chart_estado_dona(analytics.get("estado_distribucion", {}))
    if dona:
        charts["estado_dona"] = dona
    lineas = chart_barras_horizontales(
        analytics.get("por_linea", []),
        "linea",
        "avance_pct",
        "Avance por línea estratégica",
    )
    if lineas:
        charts["por_linea"] = lineas
    sectores = chart_barras_horizontales(
        analytics.get("por_sector_estado", []),
        "sector",
        "avance_fisico_pct",
        "Avance por sector MGA",
    )
    if sectores:
        charts["por_sector"] = sectores
    ods = chart_barras_horizontales(
        analytics.get("por_ods", []),
        "ods",
        "avance_pct",
        "Avance por ODS",
    )
    if ods:
        charts["por_ods"] = ods
    pres = chart_presupuestal_por_anio(analytics.get("presupuestal_por_anio", []))
    if pres:
        charts["presupuestal"] = pres
    return charts
