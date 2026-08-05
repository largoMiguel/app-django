"""KPIs, distribuciones y analítica SECOP."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Any

from .normalize import _parse_date, _parse_float  # noqa: PLC2701


def _month_key(iso: str | None) -> str | None:
    if not iso:
        return None
    try:
        d = date.fromisoformat(iso[:10])
        return f"{d.year}-{d.month:02d}"
    except ValueError:
        return None


def _estado_vigencia(rec: dict[str, Any], today: date | None = None) -> str:
    today = today or date.today()
    fin = _parse_date(rec.get("fecha_fin"))
    estado = (rec.get("estado") or "").lower()
    if "ejecuci" in estado or "celebrado" in estado or "terminad" in estado:
        if fin and fin < today:
            return "vencido"
        if fin and (fin - today).days <= 30:
            return "por_vencer"
        return "vigente"
    if "liquid" in estado:
        return "liquidado"
    return "otro"


def compute_kpis(records: list[dict[str, Any]]) -> dict[str, Any]:
    total_valor = sum(_parse_float(r.get("valor_con_adiciones") or r.get("valor")) for r in records)
    contratos = [r for r in records if r.get("tipo_registro") == "contrato"]
    procesos = [r for r in records if r.get("tipo_registro") == "proceso"]
    hoy = date.today()
    vencidos = sum(1 for r in contratos if _estado_vigencia(r, hoy) == "vencido")
    por_vencer = sum(1 for r in contratos if _estado_vigencia(r, hoy) == "por_vencer")
    vigentes = sum(1 for r in contratos if _estado_vigencia(r, hoy) == "vigente")
    return {
        "total_registros": len(records),
        "total_contratos": len(contratos),
        "total_procesos_sin_contrato": len(procesos),
        "valor_total": round(total_valor, 2),
        "valor_promedio": round(total_valor / len(contratos), 2) if contratos else 0,
        "contratos_vigentes": vigentes,
        "contratos_vencidos": vencidos,
        "contratos_por_vencer_30d": por_vencer,
        "proveedores_unicos": len(
            {r.get("documento_proveedor") for r in contratos if r.get("documento_proveedor")}
        ),
    }


def compute_hhi(records: list[dict[str, Any]]) -> float:
    contratos = [r for r in records if r.get("tipo_registro") == "contrato"]
    total = sum(_parse_float(r.get("valor")) for r in contratos)
    if total <= 0:
        return 0.0
    by_prov: dict[str, float] = defaultdict(float)
    for r in contratos:
        key = str(r.get("documento_proveedor") or r.get("proveedor") or "sin_proveedor")
        by_prov[key] += _parse_float(r.get("valor"))
    shares = [(v / total) * 100 for v in by_prov.values()]
    return round(sum(s * s for s in shares) / 100, 2)


def compute_analytics(records: list[dict[str, Any]]) -> dict[str, Any]:
    contratos = [r for r in records if r.get("tipo_registro") == "contrato"]

    def count_by(field: str, top: int = 12) -> list[dict[str, Any]]:
        c: Counter[str] = Counter()
        for r in records:
            val = str(r.get(field) or "No definido").strip() or "No definido"
            c[val] += 1
        return [{"label": k, "count": v} for k, v in c.most_common(top)]

    def sum_by(field: str, top: int = 10) -> list[dict[str, Any]]:
        totals: dict[str, float] = defaultdict(float)
        for r in contratos:
            key = str(r.get(field) or "No definido").strip() or "No definido"
            totals[key] += _parse_float(r.get("valor"))
        sorted_items = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:top]
        return [{"label": k, "valor": round(v, 2)} for k, v in sorted_items]

    monthly: dict[str, float] = defaultdict(float)
    for r in contratos:
        mk = _month_key(r.get("fecha_firma"))
        if mk:
            monthly[mk] += _parse_float(r.get("valor"))

    monthly_series = [
        {"mes": k, "valor": round(v, 2)}
        for k, v in sorted(monthly.items())
    ]

    proveedor_valor: dict[str, dict[str, Any]] = {}
    for r in contratos:
        doc = str(r.get("documento_proveedor") or "").strip()
        name = str(r.get("proveedor") or "Sin nombre").strip()
        key = doc or name
        if key not in proveedor_valor:
            proveedor_valor[key] = {"proveedor": name, "documento": doc, "valor": 0.0, "count": 0}
        proveedor_valor[key]["valor"] += _parse_float(r.get("valor"))
        proveedor_valor[key]["count"] += 1

    top_proveedores = sorted(proveedor_valor.values(), key=lambda x: x["valor"], reverse=True)[:10]
    for p in top_proveedores:
        p["valor"] = round(p["valor"], 2)

    origen_totals: dict[str, float] = defaultdict(float)
    for r in contratos:
        for item in r.get("recursos_desglose") or []:
            origen_totals[item["fuente"]] += _parse_float(item.get("valor"))
        orig = r.get("origen_recursos")
        if orig and not r.get("recursos_desglose"):
            origen_totals[str(orig)] += _parse_float(r.get("valor"))

    return {
        "kpis": compute_kpis(records),
        "hhi": compute_hhi(records),
        "por_modalidad": count_by("modalidad"),
        "por_tipo": count_by("tipo"),
        "por_estado": count_by("estado"),
        "valor_por_modalidad": sum_by("modalidad"),
        "serie_mensual": monthly_series,
        "top_proveedores_valor": top_proveedores,
        "top_proveedores_cantidad": sorted(
            top_proveedores, key=lambda x: x["count"], reverse=True
        ),
        "origen_recursos": [
            {"label": k, "valor": round(v, 2)} for k, v in sorted(origen_totals.items(), key=lambda x: -x[1])
        ],
    }


def compare_kpis(current: dict[str, Any], previous: dict[str, Any]) -> dict[str, Any]:
    def delta(key: str) -> float | None:
        cur = current.get(key)
        prev = previous.get(key)
        if cur is None or prev is None:
            return None
        try:
            return round(float(cur) - float(prev), 2)
        except (TypeError, ValueError):
            return None

    return {
        "anio_anterior": previous,
        "delta_valor_total": delta("valor_total"),
        "delta_total_contratos": delta("total_contratos"),
        "delta_proveedores": delta("proveedores_unicos"),
    }


def merge_year_trends(rows: list[dict[str, Any]], value_key: str = "total") -> list[dict[str, Any]]:
    out = []
    for row in rows:
        anio_raw = row.get("anio") or row.get("anno_firma_contrato")
        if anio_raw is None:
            continue
        try:
            anio = int(str(anio_raw).strip())
        except ValueError:
            continue
        total = _parse_float(row.get(value_key) or row.get("total"))
        out.append({"anio": anio, "total": int(total)})
    return sorted(out, key=lambda x: x["anio"])
