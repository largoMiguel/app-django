"""Pruebas de paginación en membrete PDF institucional."""
from __future__ import annotations

import fitz

from apps.common.pdf_template import apply_template_overlay, replace_page_number


def _make_informe_style_template() -> bytes:
    """Simula celda estrecha tipo F-CP-13 (paginación en esquina superior)."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    cell_x0, cell_x1 = 470, 520
    cell_y0, cell_y1 = 72, 92
    page.draw_line((cell_x0, cell_y0), (cell_x0, cell_y1), width=0.6)
    page.draw_line((cell_x1, cell_y0), (cell_x1, cell_y1), width=0.6)
    page.draw_line((cell_x0, cell_y0), (cell_x1, cell_y0), width=0.6)
    page.draw_line((cell_x0, cell_y1), (cell_x1, cell_y1), width=0.6)
    page.insert_textbox(
        fitz.Rect(cell_x0 + 2, cell_y0 + 2, cell_x1 - 2, cell_y1 - 2),
        "Página 1 de 75",
        fontsize=8,
        fontname="helv",
        color=(0, 0, 0),
        align=fitz.TEXT_ALIGN_CENTER,
    )
    out = doc.tobytes()
    doc.close()
    return out


def _phrase_bbox(page) -> fitz.Rect | None:
    hits = page.search_for("Página")
    if not hits:
        return None
    rect = hits[0]
    for token in ("de", "75"):
        for hit in page.search_for(token):
            if abs(hit.y0 - rect.y0) < 3:
                rect |= hit
    return rect


def test_replace_page_number_stays_inside_cell():
    template = _make_informe_style_template()
    doc = fitz.open(stream=template, filetype="pdf")
    page = doc[0]
    replace_page_number(page, 74, 75)
    phrase = _phrase_bbox(page)
    assert phrase is not None
    assert phrase.x1 <= 520.5, f"desborde horizontal: x1={phrase.x1}"
    doc.close()


def test_apply_template_overlay_many_pages():
    template = _make_informe_style_template()
    content = fitz.open()
    for _ in range(75):
        content.new_page(width=595, height=842)
    content_bytes = content.tobytes()
    content.close()

    result = apply_template_overlay(content_bytes, template)
    doc = fitz.open(stream=result.getvalue(), filetype="pdf")
    assert len(doc) == 75
    first = doc[0]
    last = doc[74]
    assert "Página 1 de 75" in first.get_text()
    assert "Página 75 de 75" in last.get_text()
    last_phrase = _phrase_bbox(last)
    assert last_phrase is not None
    assert last_phrase.x1 <= 520.5
    doc.close()
