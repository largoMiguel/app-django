"""Exportación Excel de registros de asistencia."""
from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.styles import Font

from .models import RegistroAsistencia
from .services import label_for_tipo


def build_registros_workbook(registros) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Asistencia"
    headers = [
        "ID",
        "Fecha y hora",
        "Cédula",
        "Funcionario",
        "Tipo",
        "Equipo",
        "Ubicación equipo",
    ]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)

    for r in registros:
        ws.append(
            [
                r.id,
                r.fecha_hora.strftime("%Y-%m-%d %H:%M:%S") if r.fecha_hora else "",
                r.funcionario.cedula,
                r.funcionario.nombre_completo,
                label_for_tipo(r.tipo),
                r.equipo.nombre,
                r.equipo.ubicacion or "",
            ]
        )

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
