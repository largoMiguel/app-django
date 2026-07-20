"""Agrupación de registros de asistencia por funcionario y día."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from django.utils import timezone

from .models import TipoRegistro
from .services import foto_url_for_registro, secuencia_for_entity


def _local_date(dt: datetime) -> date:
    return timezone.localtime(dt).date()


def _punch_slot(registro) -> dict[str, Any]:
    return {
        "id": registro.id,
        "hora": timezone.localtime(registro.fecha_hora).strftime("%H:%M:%S"),
        "fecha_hora": registro.fecha_hora.isoformat(),
        "foto_url": foto_url_for_registro(registro),
        "equipo_id": registro.equipo_id,
        "equipo_nombre": registro.equipo.nombre if registro.equipo_id else None,
    }


def build_diario_rows(entity, registros_qs) -> list[dict[str, Any]]:
    """Agrupa punches en filas (fecha, funcionario) ordenadas desc por fecha."""
    secuencia = secuencia_for_entity(entity)
    expected = len(secuencia)
    groups: dict[tuple[date, int], list] = defaultdict(list)

    for r in registros_qs.select_related("funcionario", "equipo").order_by("fecha_hora"):
        d = _local_date(r.fecha_hora)
        groups[(d, r.funcionario_id)].append(r)

    rows: list[dict[str, Any]] = []
    for (dia, _fid), punches in groups.items():
        func = punches[0].funcionario
        by_tipo: dict[str, Any] = {}
        for p in punches:
            # Conserva el primero de cada tipo (secuencia normal)
            if p.tipo not in by_tipo:
                by_tipo[p.tipo] = _punch_slot(p)

        count = sum(1 for t in secuencia if t in by_tipo)
        if count >= expected:
            estado = "completa"
            estado_label = "Completa"
        elif TipoRegistro.ENTRADA in by_tipo and count == 1:
            estado = "solo_entrada"
            estado_label = "Solo entrada"
        else:
            estado = "parcial"
            estado_label = "Parcial"

        last = punches[-1]
        rows.append(
            {
                "fecha": dia.isoformat(),
                "funcionario_id": func.id,
                "funcionario_nombre": func.nombre_completo,
                "funcionario_cedula": func.cedula,
                "asistencias_por_dia": expected,
                "entrada": by_tipo.get(TipoRegistro.ENTRADA),
                "salida_almuerzo": by_tipo.get(TipoRegistro.SALIDA_ALMUERZO),
                "retorno_almuerzo": by_tipo.get(TipoRegistro.RETORNO_ALMUERZO),
                "salida": by_tipo.get(TipoRegistro.SALIDA),
                "equipo_nombre": last.equipo.nombre if last.equipo_id else "",
                "marcaciones": count,
                "marcaciones_esperadas": expected,
                "estado": estado,
                "estado_label": estado_label,
            }
        )

    rows.sort(key=lambda x: (x["fecha"], x["funcionario_nombre"]), reverse=True)
    return rows
