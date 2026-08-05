"""Motor de alertas de riesgo en contratación SECOP."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from .normalize import _parse_date, _parse_float  # noqa: PLC2701


SEVERITY_ORDER = {"critica": 0, "alta": 1, "media": 2, "baja": 3}


def _alert(
    *,
    codigo: str,
    severidad: str,
    titulo: str,
    mensaje: str,
    fuente: str,
    registros: list[dict[str, Any]] | None = None,
    valor_implicado: float = 0.0,
) -> dict[str, Any]:
    regs = registros or []
    return {
        "codigo": codigo,
        "severidad": severidad,
        "titulo": titulo,
        "mensaje": mensaje,
        "fuente": fuente,
        "cantidad": len(regs),
        "valor_implicado": round(valor_implicado, 2),
        "registros": [
            {
                "id": r.get("id"),
                "referencia": r.get("referencia"),
                "proveedor": r.get("proveedor"),
                "valor": _parse_float(r.get("valor")),
                "estado": r.get("estado"),
                "fecha_fin": r.get("fecha_fin"),
            }
            for r in regs[:20]
        ],
    }


def _is_ejecucion(estado: str | None) -> bool:
    e = (estado or "").lower()
    return "ejecuci" in e or "celebrado" in e


def _is_terminado(estado: str | None) -> bool:
    e = (estado or "").lower()
    return "terminad" in e or "finaliz" in e or "liquid" in e


def _is_liquidado(rec: dict[str, Any]) -> bool:
    liq = str(rec.get("liquidacion") or "").lower()
    estado = (rec.get("estado") or "").lower()
    return liq in {"si", "sí", "yes"} or "liquid" in estado


def _dias_restantes(rec: dict[str, Any], today: date) -> int | None:
    fin = _parse_date(rec.get("fecha_fin"))
    if not fin:
        return None
    return (fin - today).days


def _modalidad_directa(modalidad: str | None) -> bool:
    m = (modalidad or "").lower()
    return "directa" in m or "mínima cuantía" in m or "minima cuantia" in m


def compute_alerts(
    secop1: list[dict[str, Any]],
    secop2: list[dict[str, Any]],
    *,
    nits_i: list[str],
    nits_ii: list[str],
    anio: int,
) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    today = date.today()

    if not nits_i:
        alerts.append(
            _alert(
                codigo="config_nit_secop1",
                severidad="media",
                titulo="NIT SECOP I no configurado",
                mensaje="Configure el NIT SECOP I en la entidad para consultar contratos históricos (SECOP I).",
                fuente="config",
            )
        )
    elif not secop1:
        alerts.append(
            _alert(
                codigo="sin_datos_secop1",
                severidad="baja",
                titulo=f"Sin contratos SECOP I en {anio}",
                mensaje="No se encontraron registros en SECOP I para el año seleccionado.",
                fuente="secop1",
            )
        )

    if not nits_ii:
        alerts.append(
            _alert(
                codigo="config_nit_secop2",
                severidad="media",
                titulo="NIT SECOP II no configurado",
                mensaje="Configure el NIT SECOP II en la entidad para consultar procesos y contratos actuales.",
                fuente="config",
            )
        )
    elif not secop2:
        alerts.append(
            _alert(
                codigo="sin_datos_secop2",
                severidad="baja",
                titulo=f"Sin registros SECOP II en {anio}",
                mensaje="No se encontraron procesos ni contratos en SECOP II para el año seleccionado.",
                fuente="secop2",
            )
        )

    all_contracts = [r for r in secop1 + secop2 if r.get("tipo_registro") == "contrato"]
    all_records = secop1 + secop2

    # Vencimientos
    vencidos_ejec = [
        r for r in all_contracts
        if _is_ejecucion(r.get("estado")) and (_dias_restantes(r, today) or 0) < 0
    ]
    if vencidos_ejec:
        alerts.append(
            _alert(
                codigo="vencido_en_ejecucion",
                severidad="critica",
                titulo="Contratos vencidos aún en ejecución",
                mensaje=f"{len(vencidos_ejec)} contrato(s) superaron la fecha de fin y siguen en ejecución.",
                fuente="mixto",
                registros=vencidos_ejec,
                valor_implicado=sum(_parse_float(r.get("valor")) for r in vencidos_ejec),
            )
        )

    for dias, sev, code in ((7, "critica", "por_vencer_7"), (15, "alta", "por_vencer_15"), (30, "media", "por_vencer_30")):
        bucket = [
            r for r in all_contracts
            if _is_ejecucion(r.get("estado"))
            and (_d := _dias_restantes(r, today)) is not None
            and 0 <= _d <= dias
        ]
        if bucket:
            alerts.append(
                _alert(
                    codigo=code,
                    severidad=sev,
                    titulo=f"Contratos por vencer en ≤ {dias} días",
                    mensaje=f"{len(bucket)} contrato(s) vencen en los próximos {dias} días.",
                    fuente="mixto",
                    registros=bucket,
                    valor_implicado=sum(_parse_float(r.get("valor")) for r in bucket),
                )
            )

    sin_liquidar = [
        r for r in all_contracts
        if _is_terminado(r.get("estado")) and not _is_liquidado(r)
        and (_d := _dias_restantes(r, today)) is not None
        and _d < -120
    ]
    if sin_liquidar:
        alerts.append(
            _alert(
                codigo="sin_liquidar_4m",
                severidad="alta",
                titulo="Contratos terminados sin liquidar (+4 meses)",
                mensaje=f"{len(sin_liquidar)} contrato(s) terminados hace más de 4 meses sin liquidación registrada.",
                fuente="mixto",
                registros=sin_liquidar,
            )
        )

    # Financieras
    pendiente_pago = [
        r for r in all_contracts
        if _is_terminado(r.get("estado")) and _parse_float(r.get("valor_pendiente")) > 0
    ]
    if pendiente_pago:
        alerts.append(
            _alert(
                codigo="saldo_pendiente",
                severidad="alta",
                titulo="Saldo pendiente de pago",
                mensaje=f"{len(pendiente_pago)} contrato(s) terminados con valor pendiente de pago.",
                fuente="secop2",
                registros=pendiente_pago,
                valor_implicado=sum(_parse_float(r.get("valor_pendiente")) for r in pendiente_pago),
            )
        )

    sobrepago = [
        r for r in all_contracts
        if _parse_float(r.get("valor_pagado")) > _parse_float(r.get("valor")) * 1.01
        and _parse_float(r.get("valor")) > 0
    ]
    if sobrepago:
        alerts.append(
            _alert(
                codigo="sobrepago",
                severidad="alta",
                titulo="Valor pagado superior al contrato",
                mensaje=f"{len(sobrepago)} contrato(s) con pagos que superan el valor contractual.",
                fuente="secop2",
                registros=sobrepago,
            )
        )

    adiciones_altas = [
        r for r in secop1
        if _parse_float(r.get("valor_adiciones")) > _parse_float(r.get("valor")) * 0.5
        and _parse_float(r.get("valor")) > 0
    ]
    if adiciones_altas:
        alerts.append(
            _alert(
                codigo="adiciones_50",
                severidad="alta",
                titulo="Adiciones superiores al 50 %",
                mensaje=f"{len(adiciones_altas)} contrato(s) SECOP I con adiciones que superan el 50 % del valor inicial (Ley 80).",
                fuente="secop1",
                registros=adiciones_altas,
            )
        )

    baja_ejecucion = [
        r for r in all_contracts
        if _is_terminado(r.get("estado"))
        and _parse_float(r.get("valor")) > 0
        and _parse_float(r.get("valor_pagado")) / _parse_float(r.get("valor")) < 0.5
    ]
    if baja_ejecucion:
        alerts.append(
            _alert(
                codigo="baja_ejecucion_financiera",
                severidad="media",
                titulo="Baja ejecución financiera",
                mensaje=f"{len(baja_ejecucion)} contrato(s) terminados con ejecución financiera inferior al 50 %.",
                fuente="mixto",
                registros=baja_ejecucion,
            )
        )

    # Transparencia
    total_valor = sum(_parse_float(r.get("valor")) for r in all_contracts)
    by_prov: dict[str, list[dict]] = defaultdict(list)
    for r in all_contracts:
        key = str(r.get("documento_proveedor") or r.get("proveedor") or "")
        if key:
            by_prov[key].append(r)

    concentrados = []
    for _k, items in by_prov.items():
        v = sum(_parse_float(x.get("valor")) for x in items)
        if total_valor > 0 and v / total_valor > 0.25:
            concentrados.extend(items)
    if concentrados:
        alerts.append(
            _alert(
                codigo="concentracion_proveedor",
                severidad="alta",
                titulo="Concentración de contratación en pocos proveedores",
                mensaje="Uno o más proveedores concentran más del 25 % del valor total contratado.",
                fuente="mixto",
                registros=concentrados[:20],
                valor_implicado=sum(_parse_float(r.get("valor")) for r in concentrados),
            )
        )

    directa = [r for r in all_contracts if _modalidad_directa(r.get("modalidad"))]
    if all_contracts and len(directa) / len(all_contracts) > 0.6:
        alerts.append(
            _alert(
                codigo="alta_contratacion_directa",
                severidad="media",
                titulo="Alto peso de contratación directa",
                mensaje=f"El {round(len(directa)/len(all_contracts)*100)}% de los contratos usa modalidades directas o mínima cuantía.",
                fuente="mixto",
                registros=directa[:15],
            )
        )

    sin_supervisor = [r for r in secop2 if r.get("tipo_registro") == "contrato" and not r.get("supervisor")]
    if sin_supervisor:
        alerts.append(
            _alert(
                codigo="sin_supervisor",
                severidad="media",
                titulo="Contratos sin supervisor",
                mensaje=f"{len(sin_supervisor)} contrato(s) SECOP II sin supervisor designado.",
                fuente="secop2",
                registros=sin_supervisor,
            )
        )

    desiertos = [
        r for r in secop2
        if r.get("tipo_registro") == "proceso"
        and (
            "desiert" in (r.get("estado") or "").lower()
            or _parse_float(r.get("proveedores_manifestaron")) == 0
        )
    ]
    if desiertos:
        alerts.append(
            _alert(
                codigo="procesos_desiertos",
                severidad="media",
                titulo="Procesos desiertos o sin interesados",
                mensaje=f"{len(desiertos)} proceso(s) sin adjudicación o sin manifestaciones de interés.",
                fuente="secop2",
                registros=desiertos,
            )
        )

    diciembre = [
        r for r in all_contracts
        if (d := _parse_date(r.get("fecha_firma"))) and d.month == 12
    ]
    if all_contracts and len(diciembre) / len(all_contracts) > 0.35:
        alerts.append(
            _alert(
                codigo="concentracion_diciembre",
                severidad="media",
                titulo="Concentración de firmas en diciembre",
                mensaje=f"El {round(len(diciembre)/len(all_contracts)*100)}% de contratos se firmaron en diciembre (cierre de vigencia).",
                fuente="mixto",
                registros=diciembre[:15],
            )
        )

    duracion_cero = [
        r for r in all_contracts
        if (ini := _parse_date(r.get("fecha_inicio"))) and (fin := _parse_date(r.get("fecha_fin")))
        and ini >= fin
    ]
    if duracion_cero:
        alerts.append(
            _alert(
                codigo="duracion_atipica",
                severidad="media",
                titulo="Duración contractual atípica",
                mensaje=f"{len(duracion_cero)} contrato(s) con duración cero o negativa.",
                fuente="mixto",
                registros=duracion_cero,
            )
        )

    prestacion_larga = []
    for r in all_contracts:
        if "prestaci" not in (r.get("tipo") or "").lower():
            continue
        ini = _parse_date(r.get("fecha_inicio"))
        fin = _parse_date(r.get("fecha_fin"))
        if ini and fin and (fin - ini).days > 366:
            prestacion_larga.append(r)
    if prestacion_larga:
        alerts.append(
            _alert(
                codigo="prestacion_larga",
                severidad="media",
                titulo="Prestación de servicios superior a 12 meses",
                mensaje=f"{len(prestacion_larga)} contrato(s) de prestación de servicios superan 12 meses.",
                fuente="mixto",
                registros=prestacion_larga,
            )
        )

    vigentes_por_prov: dict[str, list[dict]] = defaultdict(list)
    for r in all_contracts:
        if not _is_ejecucion(r.get("estado")):
            continue
        dr = _dias_restantes(r, today)
        if dr is None or dr < 0:
            continue
        key = str(r.get("documento_proveedor") or r.get("proveedor") or "")
        if key:
            vigentes_por_prov[key].append(r)
    multi_vigente = [items for items in vigentes_por_prov.values() if len(items) >= 3]
    if multi_vigente:
        flat = [r for items in multi_vigente for r in items]
        alerts.append(
            _alert(
                codigo="proveedor_multiples_vigentes",
                severidad="media",
                titulo="Proveedor con múltiples contratos vigentes",
                mensaje=f"{len(multi_vigente)} proveedor(es) con 3 o más contratos vigentes simultáneos.",
                fuente="mixto",
                registros=flat[:20],
            )
        )

    # Posible fraccionamiento (heurística)
    minima = [r for r in all_contracts if "mínima cuantía" in (r.get("modalidad") or "").lower() or "minima cuantia" in (r.get("modalidad") or "").lower()]
    fraccionamiento: list[dict] = []
    by_prov_min: dict[str, list[dict]] = defaultdict(list)
    for r in minima:
        key = str(r.get("documento_proveedor") or "")
        if key:
            by_prov_min[key].append(r)
    for items in by_prov_min.values():
        if len(items) >= 3:
            fraccionamiento.extend(items)
    if fraccionamiento:
        alerts.append(
            _alert(
                codigo="posible_fraccionamiento",
                severidad="alta",
                titulo="Posible fraccionamiento contractual",
                mensaje="Varios contratos de mínima cuantía al mismo proveedor en el periodo analizado.",
                fuente="mixto",
                registros=fraccionamiento[:20],
            )
        )

    alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a["severidad"], 9), -a.get("valor_implicado", 0)))
    return alerts


def filter_alerts(
    alerts: list[dict[str, Any]],
    *,
    fuente: str | None = None,
    severidad: str | None = None,
) -> list[dict[str, Any]]:
    out = alerts
    if fuente and fuente != "all":
        out = [a for a in out if a.get("fuente") in {fuente, "mixto", "config"}]
    if severidad:
        out = [a for a in out if a.get("severidad") == severidad]
    return out
