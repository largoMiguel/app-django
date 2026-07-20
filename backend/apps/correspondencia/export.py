"""Export Excel y PDF de correspondencia."""
from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_excel(rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Correspondencia"
    headers = [
        "Radicado",
        "Sentido",
        "Fecha",
        "Tipología",
        "Remitente",
        "Destinatario",
        "Asunto",
        "Secretaría",
        "Estado",
        "Vencimiento",
        "SLA",
    ]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)

    for r in rows:
        ws.append(
            [
                r.numero_radicado,
                r.get_sentido_display(),
                r.fecha_radicacion.strftime("%Y-%m-%d %H:%M") if r.fecha_radicacion else "",
                r.get_tipologia_display(),
                r.remitente_nombre,
                r.destinatario_nombre,
                r.asunto,
                r.secretaria.nombre if r.secretaria_id else "",
                r.get_estado_display(),
                r.fecha_vencimiento.strftime("%Y-%m-%d") if r.fecha_vencimiento else "",
                r.sla_status(),
            ]
        )

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 45)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_pdf(rows, *, titulo: str = "Informe de correspondencia") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter), leftMargin=24, rightMargin=24)
    styles = getSampleStyleSheet()
    story = [Paragraph(titulo, styles["Heading1"]), Spacer(1, 12)]

    data = [["Radicado", "Sentido", "Fecha", "Asunto", "Estado", "Vence"]]
    for r in rows[:500]:
        data.append(
            [
                r.numero_radicado,
                r.get_sentido_display(),
                r.fecha_radicacion.strftime("%Y-%m-%d") if r.fecha_radicacion else "",
                (r.asunto or "")[:60],
                r.get_estado_display(),
                r.fecha_vencimiento.strftime("%Y-%m-%d") if r.fecha_vencimiento else "",
            ]
        )

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0e7490")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buf.getvalue()
