"""Portada estándar para informes PDF — estructura PQRS en escala de grises."""
from __future__ import annotations

from datetime import datetime

from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, Spacer, Table, TableStyle

from apps.common.report_theme import BG_WHITE, ROW_ALT, TEXT_DARK, banner_style_cmds, light_box_style_cmds

_MESES_ES = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
}


def build_cover_flowables(
    *,
    title_line: str,
    subtitle_line: str,
    entity_name: str,
    period_text: str,
    normal_style,
    top_spacer: float = 0.5,
    extra_flowables: list | None = None,
) -> list:
    """
    Genera los flowables de portada con la estructura PQRS recoloreada:
    1. Banner superior (título + subtítulo) — fondo #2D3748, texto blanco
    2. Caja entidad — fondo #F8FAFC, texto #2D3748
    3. Caja periodo — fondo #F8FAFC, alineada a la derecha
    4. Mes de generación — alineado a la derecha
    """
    flowables: list = []

    header_style = ParagraphStyle(
        "CoverHeaderText",
        parent=normal_style,
        alignment=TA_CENTER,
        fontSize=14,
        textColor=BG_WHITE,
        fontName="Helvetica-Bold",
        leading=18,
    )
    entity_style = ParagraphStyle(
        "CoverEntityText",
        parent=normal_style,
        alignment=TA_CENTER,
        fontSize=16,
        textColor=TEXT_DARK,
        fontName="Helvetica-Bold",
    )
    period_style = ParagraphStyle(
        "CoverPeriodText",
        parent=normal_style,
        alignment=TA_RIGHT,
        fontSize=14,
        textColor=TEXT_DARK,
        fontName="Helvetica-Bold",
        leading=20,
    )
    mes_style = ParagraphStyle(
        "CoverMesStyle",
        parent=normal_style,
        fontSize=14,
        alignment=TA_RIGHT,
        fontName="Helvetica",
        textColor=TEXT_DARK,
    )

    flowables.append(Spacer(1, top_spacer * inch))

    header_html = f"<b>{title_line}</b>"
    if subtitle_line:
        header_html += f"<br/>{subtitle_line}"

    header_data = [[Paragraph(header_html, header_style)]]
    header_table = Table(header_data, colWidths=[6.5 * inch])
    header_table.setStyle(TableStyle(banner_style_cmds() + [
        ("TOPPADDING", (0, 0), (-1, -1), 20),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
    ]))
    flowables.append(header_table)
    flowables.append(Spacer(1, 0.1 * inch))

    entity_data = [[Paragraph(f"<b>{entity_name.upper()}</b>", entity_style)]]
    entity_table = Table(entity_data, colWidths=[6.5 * inch])
    entity_table.setStyle(TableStyle(light_box_style_cmds(align="CENTER")))
    flowables.append(entity_table)
    flowables.append(Spacer(1, 0.35 * inch))

    period_data = [[Paragraph(f"<b>{period_text}</b>", period_style)]]
    period_table = Table(period_data, colWidths=[6.5 * inch])
    period_table.setStyle(TableStyle(light_box_style_cmds(align="RIGHT", right_padding=30)))
    flowables.append(period_table)
    flowables.append(Spacer(1, 0.25 * inch))

    hoy = datetime.now()
    mes_generacion = f"{_MESES_ES[hoy.month]} {hoy.year}"
    flowables.append(Paragraph(mes_generacion, mes_style))

    if extra_flowables:
        flowables.extend(extra_flowables)

    flowables.append(PageBreak())
    return flowables
