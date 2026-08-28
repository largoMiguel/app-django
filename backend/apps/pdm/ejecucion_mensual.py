"""Servicios de ejecución presupuestal mensual (PIIP)."""
from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum

from apps.entities.models import Entity

from .armonizacion import codigo_efectivo, mapa_armonizacion
from .fuente_financiacion import normalizar_fuente_piip
from .models import PDMEjecucionMensual, PDMEjecucionMensualCarga

User = get_user_model()

MESES_LABEL = (
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
)


def ultimo_dia_mes(anio: int, mes: int) -> date:
    return date(anio, mes, monthrange(anio, mes)[1])


def listar_estado_mensual(entity_id: int, anio: int) -> list[dict[str, Any]]:
    cargas = {
        c.mes: c
        for c in PDMEjecucionMensualCarga.objects.filter(entity_id=entity_id, anio=anio).select_related(
            "uploaded_by"
        )
    }
    totales = (
        PDMEjecucionMensual.objects.filter(entity_id=entity_id, anio=anio)
        .values("mes")
        .annotate(registros=Count("id"), saldo_total=Sum("saldo_compromisos"), pagos_total=Sum("pagos"))
    )
    totales_map = {row["mes"]: row for row in totales}

    out: list[dict[str, Any]] = []
    for mes in range(1, 13):
        carga = cargas.get(mes)
        tot = totales_map.get(mes, {})
        out.append(
            {
                "mes": mes,
                "mes_label": MESES_LABEL[mes - 1],
                "cargado": carga is not None,
                "rango_desde": carga.rango_desde.isoformat() if carga else None,
                "rango_hasta": carga.rango_hasta.isoformat() if carga else None,
                "titulo_archivo": carga.titulo_archivo if carga else "",
                "filename": carga.filename if carga else "",
                "es_acumulado": carga.es_acumulado if carga else False,
                "registros_insertados": carga.registros_insertados if carga else 0,
                "saldo_compromisos_total": float(tot.get("saldo_total") or 0),
                "pagos_total": float(tot.get("pagos_total") or 0),
                "uploaded_at": carga.created_at.isoformat() if carga else None,
                "uploaded_by_nombre": (
                    (carga.uploaded_by.full_name or carga.uploaded_by.email) if carga and carga.uploaded_by else None
                ),
            }
        )
    return out


def ejecucion_mensual_por_descripcion_fte(
    entity_id: int,
    codigos: list[str],
    anio: int,
    mes: int,
) -> dict[str, dict[str, dict[str, float]]]:
    """Totales del mes y acumulado (meses 1..mes) por producto y descripcion_fte exacta."""
    if not codigos or mes < 1 or mes > 12:
        return {}

    rows = PDMEjecucionMensual.objects.filter(
        entity_id=entity_id,
        codigo_producto__in=codigos,
        anio=anio,
        mes__lte=mes,
    ).values("codigo_producto", "descripcion_fte", "mes", "registro", "pagos")

    grouped: dict[str, dict[str, dict[str, float]]] = defaultdict(dict)
    for row in rows:
        codigo = row["codigo_producto"]
        desc = row["descripcion_fte"] or "Sin Fuente"
        bucket = grouped[codigo].setdefault(
            desc,
            {"registro_mes": 0.0, "pagos_mes": 0.0, "registro_acum": 0.0, "pagos_acum": 0.0},
        )
        registro = float(row["registro"] or 0)
        pagos = float(row["pagos"] or 0)
        bucket["registro_acum"] += registro
        bucket["pagos_acum"] += pagos
        if int(row["mes"]) == mes:
            bucket["registro_mes"] += registro
            bucket["pagos_mes"] += pagos

    return {codigo: dict(fuentes) for codigo, fuentes in grouped.items()}


def ejecucion_mensual_por_producto_fuente(
    entity_id: int,
    codigos: list[str],
    anio: int,
    mes: int,
) -> dict[str, list[dict[str, float | str]]]:
    """Totales del mes y acumulado (meses 1..mes) por producto y fuente normalizada."""
    if not codigos or mes < 1 or mes > 12:
        return {}

    rows = PDMEjecucionMensual.objects.filter(
        entity_id=entity_id,
        codigo_producto__in=codigos,
        anio=anio,
        mes__lte=mes,
    ).values("codigo_producto", "descripcion_fte", "mes", "registro", "pagos")

    grouped: dict[str, dict[str, dict[str, float | str]]] = defaultdict(dict)
    for row in rows:
        codigo = row["codigo_producto"]
        nombre = normalizar_fuente_piip(row["descripcion_fte"])
        bucket = grouped[codigo].setdefault(
            nombre,
            {
                "nombre": nombre,
                "registro_mes": 0.0,
                "pagos_mes": 0.0,
                "registro_acum": 0.0,
                "pagos_acum": 0.0,
            },
        )
        registro = float(row["registro"] or 0)
        pagos = float(row["pagos"] or 0)
        bucket["registro_acum"] = float(bucket["registro_acum"]) + registro
        bucket["pagos_acum"] = float(bucket["pagos_acum"]) + pagos
        if int(row["mes"]) == mes:
            bucket["registro_mes"] = float(bucket["registro_mes"]) + registro
            bucket["pagos_mes"] = float(bucket["pagos_mes"]) + pagos

    return {
        codigo: sorted(fuentes.values(), key=lambda x: str(x["nombre"]))
        for codigo, fuentes in grouped.items()
    }


def persistir_ejecucion_mensual(
    entity: Entity,
    user: User,
    anio: int,
    mes: int,
    periodo: dict[str, Any],
    rows_data: list[dict[str, Any]],
    filename: str,
) -> tuple[int, bool]:
    """Reemplaza el mes e inserta filas. Devuelve (registros, saldo_compromisos_en_cero)."""
    mapa = mapa_armonizacion(entity)
    saldo_cero = all(float(item.get("saldo_compromisos") or 0) == 0 for item in rows_data) if rows_data else False

    PDMEjecucionMensual.objects.filter(entity=entity, anio=anio, mes=mes).delete()
    PDMEjecucionMensualCarga.objects.filter(entity=entity, anio=anio, mes=mes).delete()

    bulk: list[PDMEjecucionMensual] = []
    for item in rows_data:
        codigo_raw = str(item["codigo_producto"] or "").strip()
        codigo_resuelto = codigo_efectivo(entity, codigo_raw, mapa)
        bulk.append(
            PDMEjecucionMensual(
                entity=entity,
                anio=anio,
                mes=mes,
                codigo_producto_origen=codigo_raw,
                codigo_producto=codigo_resuelto,
                descripcion_fte=item["descripcion_fte"],
                pto_inicial=item["pto_inicial"],
                adicion=item["adicion"],
                reduccion=item["reduccion"],
                credito=item["credito"],
                contracredito=item["contracredito"],
                pto_definitivo=item["pto_definitivo"],
                registro=item.get("registro", 0),
                obligaciones=item.get("obligaciones", 0),
                saldo_compromisos=item.get("saldo_compromisos", 0),
                pagos=item["pagos"],
                sector=item.get("sector"),
                dependencia=item.get("dependencia"),
                bpin=item.get("bpin"),
            )
        )
    if bulk:
        PDMEjecucionMensual.objects.bulk_create(bulk)

    PDMEjecucionMensualCarga.objects.create(
        entity=entity,
        anio=anio,
        mes=mes,
        rango_desde=periodo["desde"],
        rango_hasta=periodo["hasta"],
        titulo_archivo=periodo.get("titulo") or "",
        filename=filename,
        es_acumulado=bool(periodo.get("es_acumulado")),
        registros_insertados=len(bulk),
        uploaded_by=user,
    )
    return len(bulk), saldo_cero
