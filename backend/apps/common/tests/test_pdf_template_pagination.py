"""Pruebas de paginación en membrete PDF institucional."""
from __future__ import annotations

import re
from pathlib import Path

import fitz

from apps.common.pdf_template import apply_template_overlay, replace_page_number

CELL_X0, CELL_X1 = 470, 520
CELL_Y0, CELL_Y1 = 72, 92
TEMPLATE_FONT_SIZE = 8.0


def _make_informe_style_template() -> bytes:
    """Simula celda estrecha tipo F-CP-13 (paginación en esquina superior)."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.draw_line((CELL_X0, CELL_Y0), (CELL_X0, CELL_Y1), width=0.6)
    page.draw_line((CELL_X1, CELL_Y0), (CELL_X1, CELL_Y1), width=0.6)
    page.draw_line((CELL_X0, CELL_Y0), (CELL_X1, CELL_Y0), width=0.6)
    page.draw_line((CELL_X0, CELL_Y1), (CELL_X1, CELL_Y1), width=0.6)
    seed = "Página 1 de 9"
    text_width = fitz.get_text_length(seed, fontname="helv", fontsize=TEMPLATE_FONT_SIZE)
    baseline_y = CELL_Y0 + (CELL_Y1 - CELL_Y0) * 0.72
    text_x = CELL_X0 + (CELL_X1 - CELL_X0 - text_width) / 2
    page.insert_text(
        (text_x, baseline_y),
        seed,
        fontsize=TEMPLATE_FONT_SIZE,
        fontname="helv",
        color=(0, 0, 0),
    )
    out = doc.tobytes()
    doc.close()
    return out


def _find_pagination_line(page) -> dict | None:
    phrase_re = re.compile(r"P[aá]gina\s+\d+\s+de\s+\d+", re.IGNORECASE)
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            line_text = "".join(span["text"] for span in line.get("spans", [])).strip()
            if phrase_re.search(line_text):
                return line
    return None


def _phrase_bbox(page) -> fitz.Rect | None:
    line = _find_pagination_line(page)
    if line is None:
        return None
    return fitz.Rect(line["bbox"])


def _phrase_fits_cell(page) -> bool:
    line = _find_pagination_line(page)
    if line is None:
        return False
    span = line["spans"][0]
    origin = span.get("origin") or (line["bbox"][0], line["bbox"][3])
    fontname = "hebo" if int(span.get("flags", 0)) & 16 else "helv"
    fontsize = float(span.get("size", 8))
    text = "".join(s["text"] for s in line["spans"])
    width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
    return float(origin[0]) + width <= CELL_X1


def _line_baseline_y(line: dict) -> float | None:
    for span in line.get("spans", []):
        origin = span.get("origin")
        if origin:
            return float(origin[1])
    bbox = line.get("bbox")
    if bbox:
        return float(bbox[3]) - 0.8
    return None


def test_replace_page_number_stays_inside_cell():
    template = _make_informe_style_template()
    doc = fitz.open(stream=template, filetype="pdf")
    page = doc[0]
    before = _find_pagination_line(page)
    assert before is not None
    before_baseline = _line_baseline_y(before)

    replace_page_number(page, 0, 9)

    after = _find_pagination_line(page)
    assert after is not None
    assert "Página 1 de 9" in "".join(s["text"] for s in after["spans"])
    assert _phrase_fits_cell(page)

    after_baseline = _line_baseline_y(after)
    assert before_baseline is not None and after_baseline is not None
    assert abs(after_baseline - before_baseline) <= 1.5

    sizes = [float(s.get("size", 0)) for s in after["spans"] if s.get("text", "").strip()]
    assert sizes
    assert max(sizes) == TEMPLATE_FONT_SIZE
    doc.close()


def test_replace_page_number_scales_when_needed():
    template = _make_informe_style_template()
    doc = fitz.open(stream=template, filetype="pdf")
    page = doc[0]
    replace_page_number(page, 99, 100)
    after = _find_pagination_line(page)
    assert after is not None
    assert _phrase_fits_cell(page)
    sizes = [float(s.get("size", 0)) for s in after["spans"] if s.get("text", "").strip()]
    assert min(sizes) >= 5.0
    assert max(sizes) < TEMPLATE_FONT_SIZE
    doc.close()


def test_apply_template_overlay_many_pages():
    template = _make_informe_style_template()
    content = fitz.open()
    total = 12
    for _ in range(total):
        content.new_page(width=595, height=842)
    content_bytes = content.tobytes()
    content.close()

    result = apply_template_overlay(content_bytes, template)
    doc = fitz.open(stream=result.getvalue(), filetype="pdf")
    assert len(doc) == total
    first = doc[0]
    last = doc[total - 1]
    assert "Página 1 de 12" in first.get_text()
    assert "Página 12 de 12" in last.get_text()
    assert _phrase_fits_cell(last)
    doc.close()


def test_render_pagination_cell_preview_png(tmp_path: Path):
    """Genera recorte PNG de la celda para revisión visual."""
    template = _make_informe_style_template()
    doc = fitz.open(stream=template, filetype="pdf")
    page = doc[0]
    replace_page_number(page, 0, 9)
    clip = fitz.Rect(CELL_X0 - 2, CELL_Y0 - 2, CELL_X1 + 2, CELL_Y1 + 2)
    pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(3, 3))
    out = tmp_path / "pagination_cell.png"
    pix.save(out)
    assert out.stat().st_size > 200
    doc.close()
