"""Armonización manual de códigos de ejecución presupuestal con el Plan Indicativo."""
from __future__ import annotations

from django.db import transaction
from django.db.models import F, Sum

from apps.entities.models import Entity

from .models import PDMEjecucionPresupuestal, PdmArmonizacionEjecucion, PdmProducto
from .producto_codigo import codigos_referencia_plan_entidad, resolver_codigo_producto_pdm


class ArmonizacionError(ValueError):
    """Error de validación al crear o revertir una armonización."""


def mapa_armonizacion(entity: Entity) -> dict[str, str]:
    return {
        str(row["codigo_origen"]).strip(): str(row["codigo_destino"]).strip()
        for row in PdmArmonizacionEjecucion.objects.filter(entity=entity).values("codigo_origen", "codigo_destino")
        if str(row["codigo_origen"]).strip() and str(row["codigo_destino"]).strip()
    }


def codigo_efectivo(entity: Entity, codigo_raw: str, mapa: dict[str, str] | None = None) -> str:
    codigo = resolver_codigo_producto_pdm(entity, codigo_raw)
    if mapa is None:
        mapa = mapa_armonizacion(entity)
    return mapa.get(codigo, codigo)


def _totales_codigo_origen(entity: Entity, codigo_origen: str) -> dict[str, float]:
    agg = (
        PDMEjecucionPresupuestal.objects.filter(entity=entity, codigo_producto_origen=codigo_origen)
        .aggregate(pto_definitivo=Sum("pto_definitivo"), pagos=Sum("pagos"))
    )
    return {
        "pto_definitivo": float(agg["pto_definitivo"] or 0),
        "pagos": float(agg["pagos"] or 0),
    }


def _producto_destino(entity: Entity, codigo_destino: str) -> PdmProducto | None:
    return (
        PdmProducto.objects.filter(entity=entity, codigo_producto=codigo_destino)
        .order_by("id")
        .first()
    )


def validar_armonizacion(entity: Entity, codigo_origen: str, codigo_destino: str) -> None:
    origen = str(codigo_origen or "").strip()
    destino = str(codigo_destino or "").strip()
    if not origen:
        raise ArmonizacionError("El código origen es obligatorio.")
    if not destino:
        raise ArmonizacionError("El código destino es obligatorio.")
    if origen == destino:
        raise ArmonizacionError("El código origen y destino no pueden ser iguales.")

    codigos_plan = codigos_referencia_plan_entidad(entity)
    if origen in codigos_plan:
        raise ArmonizacionError(f"El código {origen} ya existe en el Plan Indicativo.")

    if not _producto_destino(entity, destino):
        raise ArmonizacionError(f"El código {destino} no existe en el Plan Indicativo.")

    if PdmArmonizacionEjecucion.objects.filter(entity=entity, codigo_origen=origen).exists():
        raise ArmonizacionError(f"El código {origen} ya tiene una armonización registrada.")

    if PdmArmonizacionEjecucion.objects.filter(entity=entity, codigo_destino=origen).exists():
        raise ArmonizacionError(
            f"El código {origen} es destino de otra armonización; no se permiten cadenas."
        )


def codigos_armonizados_para_producto(entity_id: int, codigo_producto: str) -> list[str]:
    codigos = (
        PDMEjecucionPresupuestal.objects.filter(
            entity_id=entity_id,
            codigo_producto=codigo_producto,
        )
        .exclude(codigo_producto_origen=F("codigo_producto"))
        .exclude(codigo_producto_origen="")
        .values_list("codigo_producto_origen", flat=True)
        .distinct()
    )
    return sorted({str(c).strip() for c in codigos if str(c).strip()})


def serializar_armonizacion(arm: PdmArmonizacionEjecucion) -> dict:
    producto = _producto_destino(arm.entity, arm.codigo_destino)
    totales = _totales_codigo_origen(arm.entity, arm.codigo_origen)
    created_by = arm.created_by
    return {
        "id": arm.id,
        "codigo_origen": arm.codigo_origen,
        "codigo_destino": arm.codigo_destino,
        "clave_producto_destino": arm.clave_producto_destino,
        "producto_destino_nombre": (producto.producto_mga or producto.indicador_producto_mga or "") if producto else "",
        "producto_destino_linea": producto.linea_estrategica if producto else "",
        "nota": arm.nota or "",
        "pto_definitivo": totales["pto_definitivo"],
        "pagos": totales["pagos"],
        "created_at": arm.created_at.isoformat() if arm.created_at else None,
        "created_by_nombre": (created_by.full_name or created_by.email) if created_by else None,
    }


@transaction.atomic
def aplicar_armonizacion(
    entity: Entity,
    codigo_origen: str,
    codigo_destino: str,
    *,
    nota: str = "",
    created_by=None,
) -> dict:
    validar_armonizacion(entity, codigo_origen, codigo_destino)
    origen = str(codigo_origen).strip()
    destino = str(codigo_destino).strip()
    producto = _producto_destino(entity, destino)
    assert producto is not None

    arm = PdmArmonizacionEjecucion.objects.create(
        entity=entity,
        codigo_origen=origen,
        codigo_destino=destino,
        clave_producto_destino=producto.clave_producto,
        nota=(nota or "").strip(),
        created_by=created_by,
    )
    filas_afectadas = PDMEjecucionPresupuestal.objects.filter(
        entity=entity,
        codigo_producto_origen=origen,
    ).update(codigo_producto=destino)
    totales = _totales_codigo_origen(entity, origen)
    payload = serializar_armonizacion(arm)
    payload["filas_afectadas"] = filas_afectadas
    payload["pto_definitivo"] = totales["pto_definitivo"]
    payload["pagos"] = totales["pagos"]
    return payload


@transaction.atomic
def revertir_armonizacion(entity: Entity, armonizacion_id: int) -> dict:
    arm = PdmArmonizacionEjecucion.objects.filter(entity=entity, id=armonizacion_id).first()
    if not arm:
        raise ArmonizacionError("Armonización no encontrada.")

    origen = arm.codigo_origen
    filas_afectadas = PDMEjecucionPresupuestal.objects.filter(
        entity=entity,
        codigo_producto_origen=origen,
    ).update(codigo_producto=F("codigo_producto_origen"))
    arm.delete()
    return {"success": True, "codigo_origen": origen, "filas_afectadas": filas_afectadas}
