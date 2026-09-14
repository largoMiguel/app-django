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


def _is_ejecucion(estado: str | None) -> bool:
    e = (estado or "").lower()
    return "ejecuci" in e or "celebrado" in e


def _is_liquidado(rec: dict[str, Any]) -> bool:
    liq = str(rec.get("liquidacion") or "").lower()
    estado = (rec.get("estado") or "").lower()
    return liq in {"si", "sí", "yes"} or "liquid" in estado or rec.get("liquidado") is True


def _dias_restantes(rec: dict[str, Any], today: date | None = None) -> int | None:
    today = today or date.today()
    fin = _parse_date(rec.get("fecha_fin"))
    if not fin:
        return None
    return (fin - today).days


def compute_avance(rec: dict[str, Any], today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    ini = _parse_date(rec.get("fecha_inicio")) or _parse_date(rec.get("fecha_firma"))
    fin = _parse_date(rec.get("fecha_fin"))
    avance_tiempo = None
    if ini and fin and fin > ini:
        total_dias = (fin - ini).days
        transcurridos = max(0, min((today - ini).days, total_dias))
        avance_tiempo = round(transcurridos / total_dias * 100, 1) if total_dias > 0 else None

    valor_total = _parse_float(rec.get("valor_con_adiciones") or rec.get("valor"))
    pagado = _parse_float(rec.get("total_pagado_real") or rec.get("valor_pagado"))
    avance_financiero = None
    if rec.get("datos_pago_disponibles") and valor_total > 0:
        avance_financiero = round(min(pagado / valor_total * 100, 100), 1)

    desviacion = None
    if avance_tiempo is not None and avance_financiero is not None:
        desviacion = round(avance_financiero - avance_tiempo, 1)

    dias_rest = _dias_restantes(rec, today)
    semaforo = "gris"
    if avance_tiempo is not None or avance_financiero is not None:
        if dias_rest is not None and dias_rest < 0 and _is_ejecucion(rec.get("estado")):
            semaforo = "rojo"
        elif desviacion is not None and desviacion < -20:
            semaforo = "rojo"
        elif desviacion is not None and desviacion < -10:
            semaforo = "amarillo"
        elif dias_rest is not None and 0 <= dias_rest <= 15:
            semaforo = "amarillo"
        else:
            semaforo = "verde"

    return {
        "avance_tiempo": avance_tiempo,
        "avance_financiero": avance_financiero,
        "desviacion": desviacion,
        "dias_restantes": dias_rest,
        "semaforo": semaforo,
    }


def compute_kpis(records: list[dict[str, Any]]) -> dict[str, Any]:
    total_valor = sum(_parse_float(r.get("valor_con_adiciones") or r.get("valor")) for r in records)
    contratos = [r for r in records if r.get("tipo_registro") == "contrato"]
    procesos = [r for r in records if r.get("tipo_registro") == "proceso"]
    hoy = date.today()
    vencidos = sum(1 for r in contratos if _estado_vigencia(r, hoy) == "vencido")
    por_vencer = sum(1 for r in contratos if _estado_vigencia(r, hoy) == "por_vencer")
    vigentes = sum(1 for r in contratos if _estado_vigencia(r, hoy) == "vigente")
    total_pagado = sum(
        _parse_float(r.get("total_pagado_real") or r.get("valor_pagado"))
        for r in contratos
        if r.get("datos_pago_disponibles")
    )
    return {
        "total_registros": len(records),
        "total_contratos": len(contratos),
        "total_procesos_sin_contrato": len(procesos),
        "valor_total": round(total_valor, 2),
        "valor_promedio": round(total_valor / len(contratos), 2) if contratos else 0,
        "valor_pagado_total": round(total_pagado, 2),
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


def agrupar_por_responsable(
    records: list[dict[str, Any]],
    campo: str = "supervisor",
) -> list[dict[str, Any]]:
    contratos = [r for r in records if r.get("tipo_registro") == "contrato"]
    groups: dict[str, list[dict]] = defaultdict(list)
    for r in contratos:
        key = str(r.get(campo) or "Sin asignar").strip() or "Sin asignar"
        groups[key].append(r)

    out: list[dict[str, Any]] = []
    today = date.today()
    for nombre, items in groups.items():
        valor = sum(_parse_float(i.get("valor_con_adiciones") or i.get("valor")) for i in items)
        pagado = sum(
            _parse_float(i.get("total_pagado_real") or i.get("valor_pagado"))
            for i in items
            if i.get("datos_pago_disponibles")
        )
        avances = [compute_avance(i, today) for i in items]
        avance_prom = None
        financieros = [a["avance_financiero"] for a in avances if a["avance_financiero"] is not None]
        if financieros:
            avance_prom = round(sum(financieros) / len(financieros), 1)
        out.append({
            "nombre": nombre,
            "campo": campo,
            "contratos": len(items),
            "valor_total": round(valor, 2),
            "valor_pagado": round(pagado, 2),
            "avance_promedio": avance_prom,
            "vencidos": sum(1 for i in items if _estado_vigencia(i, today) == "vencido"),
            "por_vencer_30d": sum(1 for i in items if _estado_vigencia(i, today) == "por_vencer"),
            "sin_liquidar": sum(
                1 for i in items
                if _estado_vigencia(i, today) == "vencido" and not _is_liquidado(i)
            ),
        })
    return sorted(out, key=lambda x: x["valor_total"], reverse=True)


def buckets_vencimiento(records: list[dict[str, Any]]) -> dict[str, Any]:
    contratos = [r for r in records if r.get("tipo_registro") == "contrato"]
    today = date.today()
    buckets: dict[str, list[dict]] = {
        "vencidos_ejecucion": [],
        "por_vencer_7": [],
        "por_vencer_15": [],
        "por_vencer_30": [],
        "por_vencer_60": [],
        "vencidos_sin_liquidar": [],
    }
    for r in contratos:
        dias = _dias_restantes(r, today)
        avance = compute_avance(r, today)
        pub = public_summary(r, avance)
        if _is_ejecucion(r.get("estado")) and dias is not None and dias < 0:
            buckets["vencidos_ejecucion"].append(pub)
        elif _is_ejecucion(r.get("estado")) and dias is not None:
            if dias <= 7:
                buckets["por_vencer_7"].append(pub)
            elif dias <= 15:
                buckets["por_vencer_15"].append(pub)
            elif dias <= 30:
                buckets["por_vencer_30"].append(pub)
            elif dias <= 60:
                buckets["por_vencer_60"].append(pub)
        if dias is not None and dias < 0 and not _is_liquidado(r):
            buckets["vencidos_sin_liquidar"].append(pub)

    return {
        key: {"count": len(items), "valor": round(sum(i.get("valor", 0) for i in items), 2), "registros": items[:20]}
        for key, items in buckets.items()
    }


def public_summary(rec: dict[str, Any], avance: dict[str, Any] | None = None) -> dict[str, Any]:
    avance = avance or compute_avance(rec)
    return {
        "id": rec.get("id"),
        "fuente": rec.get("fuente"),
        "referencia": rec.get("numero_proceso") or rec.get("referencia"),
        "numero_proceso": rec.get("numero_proceso") or rec.get("referencia"),
        "proveedor": rec.get("proveedor"),
        "estado": rec.get("estado"),
        "valor": _parse_float(rec.get("valor_con_adiciones") or rec.get("valor")),
        "valor_pagado": _parse_float(rec.get("total_pagado_real") or rec.get("valor_pagado")),
        "fecha_fin": rec.get("fecha_fin"),
        "supervisor": rec.get("supervisor"),
        "ordenador_gasto": rec.get("ordenador_gasto"),
        **avance,
    }


def curva_pagos(records: list[dict[str, Any]]) -> dict[str, Any]:
    monthly: dict[str, float] = defaultdict(float)
    recientes: list[dict[str, Any]] = []
    sin_pago: list[dict[str, Any]] = []

    for r in records:
        if r.get("tipo_registro") != "contrato":
            continue
        pagos = r.get("pagos") or []
        if not pagos and r.get("datos_pago_disponibles"):
            sin_pago.append(public_summary(r))
        for p in pagos:
            fecha = p.get("fecha")
            if not fecha:
                continue
            mk = _month_key(str(fecha))
            if mk and (p.get("pago_confirmado") or (p.get("estado") or "").lower() == "pagado"):
                monthly[mk] += _parse_float(p.get("valor_total"))
            recientes.append({
                **p,
                "contrato_id": r.get("id"),
                "referencia": r.get("referencia"),
                "proveedor": r.get("proveedor"),
            })

    recientes.sort(key=lambda x: x.get("fecha") or "", reverse=True)
    serie = [{"mes": k, "valor": round(v, 2)} for k, v in sorted(monthly.items())]
    return {
        "serie_mensual_pagos": serie,
        "pagos_recientes": recientes[:30],
        "contratos_sin_pago": sin_pago[:30],
        "total_pagado": round(sum(monthly.values()), 2),
    }


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

    pagos_info = curva_pagos(records)

    return {
        "kpis": compute_kpis(records),
        "hhi": compute_hhi(records),
        "por_modalidad": count_by("modalidad"),
        "por_tipo": count_by("tipo"),
        "por_estado": count_by("estado"),
        "valor_por_modalidad": sum_by("modalidad"),
        "serie_mensual": monthly_series,
        "serie_mensual_pagos": pagos_info["serie_mensual_pagos"],
        "top_proveedores_valor": top_proveedores,
        "top_proveedores_cantidad": sorted(
            top_proveedores, key=lambda x: x["count"], reverse=True
        ),
        "origen_recursos": [
            {"label": k, "valor": round(v, 2)} for k, v in sorted(origen_totals.items(), key=lambda x: -x[1])
        ],
        "por_supervisor": agrupar_por_responsable(records, "supervisor"),
        "por_ordenador": agrupar_por_responsable(records, "ordenador_gasto"),
        "vencimientos": buckets_vencimiento(records),
        "pagos": pagos_info,
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
        "delta_valor_pagado": delta("valor_pagado_total"),
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
