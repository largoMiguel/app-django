"""Paleta y utilidades de estilo compartidas para informes PDF institucionales."""
from __future__ import annotations

from reportlab.lib import colors

# --- ReportLab ---
TEXT_DARK = colors.HexColor("#2D3748")
LINE_MID = colors.HexColor("#CBD5E1")
ROW_ALT = colors.HexColor("#F8FAFC")
BG_WHITE = colors.HexColor("#FFFFFF")

# --- Matplotlib ---
MPL_TEXT = "#2D3748"
MPL_LINE = "#CBD5E1"
MPL_BAR = "#2D3748"
MPL_BAR_SOFT = "#94A3B8"


def table_style_cmds(
    *,
    n_rows: int,
    header_rows: int = 1,
    numeric_cols: tuple[int, ...] = (),
    left_cols: tuple[int, ...] = (),
    include_zebra: bool = True,
) -> list[tuple]:
    """
    Estilo estándar de tablas institucionales:
    - Encabezado: fondo #2D3748, texto blanco, negrita
    - Filas alternas: blanco / #F8FAFC
    - Bordes horizontales 0.5pt #CBD5E1 (sin líneas verticales)
    - Texto a la izquierda, números a la derecha
    """
    cmds: list[tuple] = [
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), TEXT_DARK),
        ("TEXTCOLOR", (0, 0), (-1, header_rows - 1), BG_WHITE),
        ("FONTNAME", (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]

    if include_zebra and n_rows > header_rows:
        cmds.append(
            ("ROWBACKGROUNDS", (0, header_rows), (-1, -1), [BG_WHITE, ROW_ALT]),
        )

    for row in range(n_rows):
        cmds.append(("LINEBELOW", (0, row), (-1, row), 0.5, LINE_MID))

    for col in left_cols:
        cmds.append(("ALIGN", (col, header_rows), (col, -1), "LEFT"))
        cmds.append(("ALIGN", (col, 0), (col, header_rows - 1), "LEFT"))

    for col in numeric_cols:
        cmds.append(("ALIGN", (col, header_rows), (col, -1), "RIGHT"))
        cmds.append(("ALIGN", (col, 0), (col, header_rows - 1), "RIGHT"))

    return cmds


def banner_style_cmds() -> list[tuple]:
    """Estilo para banners de sección (fondo oscuro, texto blanco)."""
    return [
        ("BACKGROUND", (0, 0), (-1, -1), TEXT_DARK),
        ("TEXTCOLOR", (0, 0), (-1, -1), BG_WHITE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]


def light_box_style_cmds(*, align: str = "CENTER", right_padding: int = 15) -> list[tuple]:
    """Estilo para cajas claras de portada (entidad, periodo)."""
    cmds = [
        ("BACKGROUND", (0, 0), (-1, -1), ROW_ALT),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT_DARK),
        ("ALIGN", (0, 0), (-1, -1), align),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 15),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 15),
        ("LEFTPADDING", (0, 0), (-1, -1), 15),
        ("RIGHTPADDING", (0, 0), (-1, -1), right_padding),
    ]
    return cmds
