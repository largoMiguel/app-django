"""Helpers compartidos para membrete PDF institucional (PQRS, PDM, etc.)."""
from __future__ import annotations

import logging
import re
from io import BytesIO

import fitz

from django.conf import settings

from apps.common.b2_client import get_b2_client

logger = logging.getLogger(__name__)

_PAGE_NUM_PHRASE_RE = re.compile(r"P[aá]gina\s+\d+\s+de\s+\d+", re.IGNORECASE)
_TEXT_FONT_BOLD = 16


def detect_template_margins(template_pdf_bytes: bytes) -> tuple[float, float]:
    """
    Analiza el template PDF y detecta automáticamente el espacio
    que ocupan el encabezado (arriba) y el pie de página (abajo).
    Retorna (top_margin_inches, bottom_margin_inches).
    """
    doc = fitz.open(stream=template_pdf_bytes, filetype="pdf")
    page = doc[0]
    page_height = page.rect.height
    mid_y = page_height / 2
    padding_pt = 14

    header_bottom = 0.0
    footer_top = page_height

    for block in page.get_text("blocks"):
        _x0, y0, _x1, y1 = block[:4]
        if y1 < mid_y:
            header_bottom = max(header_bottom, y1)
        elif y0 > mid_y:
            footer_top = min(footer_top, y0)

    for draw in page.get_drawings():
        rect = draw.get("rect")
        if rect:
            if rect.y1 < mid_y:
                header_bottom = max(header_bottom, rect.y1)
            elif rect.y0 > mid_y:
                footer_top = min(footer_top, rect.y0)

    for img in page.get_image_info(xrefs=True):
        bbox = img.get("bbox")
        if bbox:
            y0, y1 = bbox[1], bbox[3]
            if y1 < mid_y:
                header_bottom = max(header_bottom, y1)
            elif y0 > mid_y:
                footer_top = min(footer_top, y0)

    doc.close()

    top_in = (header_bottom + padding_pt) / 72.0
    bottom_in = (page_height - footer_top + padding_pt) / 72.0
    top_in = round(max(0.75, min(3.5, top_in)), 3)
    bottom_in = round(max(0.5, min(2.5, bottom_in)), 3)
    return top_in, bottom_in


def _find_page_number_word_indices(words: list) -> tuple[int, int, int, int] | None:
    for idx in range(len(words) - 3):
        label = str(words[idx][4]).strip().lower()
        num_a = str(words[idx + 1][4]).strip()
        linker = str(words[idx + 2][4]).strip().lower()
        num_b = str(words[idx + 3][4]).strip()
        if not re.match(r"p[aá]gina", label, re.IGNORECASE):
            continue
        if linker != "de" or not num_a.isdigit() or not num_b.isdigit():
            continue
        return idx, idx + 1, idx + 2, idx + 3
    return None


def _word_rect(word) -> fitz.Rect:
    return fitz.Rect(word[0], word[1], word[2], word[3])


def _cover_rect_white(page, rect: fitz.Rect, pad_x: float = 4, pad_y: float = 1) -> None:
    """Cubre un rectángulo con blanco sólido (evita artefactos de redacción)."""
    cover = fitz.Rect(
        rect.x0 - pad_x,
        rect.y0 - pad_y,
        rect.x1 + pad_x,
        rect.y1 + pad_y,
    )
    page.draw_rect(cover, color=(1, 1, 1), fill=(1, 1, 1))


def _find_pagina_line_rect(page) -> fitz.Rect | None:
    """Localiza solo la línea 'Página X de Y' sin incluir Versión u otros textos."""
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            line_text = "".join(span["text"] for span in line.get("spans", [])).strip()
            if _PAGE_NUM_PHRASE_RE.search(line_text):
                bbox = line["bbox"]
                return fitz.Rect(bbox)
    return None


def _words_on_same_line(words: list, start_idx: int, end_idx: int, tolerance: float = 2.0) -> bool:
    y_values = [words[i][1] for i in range(start_idx, end_idx + 1)]
    return (max(y_values) - min(y_values)) <= tolerance


def _int_color_to_rgb(color) -> tuple[float, float, float]:
    if isinstance(color, (list, tuple)) and len(color) >= 3:
        return (float(color[0]), float(color[1]), float(color[2]))
    packed = int(color)
    return (
        ((packed >> 16) & 255) / 255.0,
        ((packed >> 8) & 255) / 255.0,
        (packed & 255) / 255.0,
    )


def _fontname_from_span(span: dict) -> str:
    flags = int(span.get("flags", 0))
    if flags & _TEXT_FONT_BOLD:
        return "hebo"
    font = (span.get("font") or "").lower()
    if "bold" in font or "black" in font:
        return "hebo"
    return "helv"


def _style_for_rect(page, rect: fitz.Rect) -> dict:
    best_overlap = 0.0
    best: dict | None = None
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                srect = fitz.Rect(span["bbox"])
                overlap = srect & rect
                if overlap.is_empty:
                    continue
                area = overlap.width * overlap.height
                if area > best_overlap:
                    best_overlap = area
                    best = span
    if best is None:
        return {"size": 9.0, "color": (0.0, 0.0, 0.0), "fontname": "helv"}
    return {
        "size": float(best.get("size", 9.0)),
        "color": _int_color_to_rgb(best.get("color", 0)),
        "fontname": _fontname_from_span(best),
    }


_PAGINA_LABEL_RE = re.compile(r"p[aá]gina", re.IGNORECASE)


def _pagination_span_style(page, line_rect: fitz.Rect) -> dict | None:
    """Estilo y baseline del span «Página» en la línea de paginación."""
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            line_text = "".join(span["text"] for span in line.get("spans", [])).strip()
            if not _PAGE_NUM_PHRASE_RE.search(line_text):
                continue
            line_bbox = line["bbox"]
            for span in line.get("spans", []):
                if not _PAGINA_LABEL_RE.search(span.get("text", "")):
                    continue
                origin = span.get("origin")
                if origin:
                    baseline = float(origin[1])
                else:
                    baseline = float(span["bbox"][3]) - 0.8
                return {
                    "size": float(span.get("size", 9.0)),
                    "color": _int_color_to_rgb(span.get("color", 0)),
                    "fontname": _fontname_from_span(span),
                    "baseline": baseline,
                    "line_x0": float(line_bbox[0]),
                    "line_x1": float(line_bbox[2]),
                }
            first = line["spans"][0]
            origin = first.get("origin")
            baseline = float(origin[1]) if origin else float(line_bbox[3]) - 0.8
            return {
                "size": float(first.get("size", 9.0)),
                "color": _int_color_to_rgb(first.get("color", 0)),
                "fontname": _fontname_from_span(first),
                "baseline": baseline,
                "line_x0": float(line_bbox[0]),
                "line_x1": float(line_bbox[2]),
            }
    return None


def _pagination_cell_bounds(page, line_rect: fitz.Rect) -> tuple[float, float]:
    cell_x0 = max(0.0, line_rect.x0 - 24.0)
    cell_x1 = min(page.rect.x1 - 12.0, line_rect.x1 + 24.0)
    tol_y = max(6.0, line_rect.height * 2.5)
    phrase_center = (line_rect.x0 + line_rect.x1) / 2
    left_edges: list[float] = []
    right_edges: list[float] = []

    for draw in page.get_drawings():
        rect = draw.get("rect")
        if rect is None:
            continue
        if rect.width > 4:
            continue
        if rect.y1 < line_rect.y0 - tol_y or rect.y0 > line_rect.y1 + tol_y:
            continue
        x = float(rect.x0)
        if x < phrase_center - 2:
            left_edges.append(x)
        elif x > phrase_center + 2:
            right_edges.append(x)

    if left_edges:
        cell_x0 = max(left_edges)
    if right_edges:
        cell_x1 = min(right_edges)
    if cell_x1 <= cell_x0 + 8:
        cell_x0 = line_rect.x0 - 2
        cell_x1 = line_rect.x1 + 2
    return cell_x0, cell_x1


def _render_pagination_in_cell(page, line_rect: fitz.Rect, text: str) -> None:
    """Redibuja la frase completa dentro de la celda del membrete."""
    style = _pagination_span_style(page, line_rect)
    if style is None:
        fallback = _style_for_rect(page, line_rect)
        style = {
            **fallback,
            "baseline": line_rect.y1 - 0.8,
            "line_x0": line_rect.x0,
            "line_x1": line_rect.x1,
        }

    cell_x0, cell_x1 = _pagination_cell_bounds(page, line_rect)
    clear_rect = fitz.Rect(
        cell_x0 + 1,
        line_rect.y0 - 1,
        cell_x1 - 1,
        line_rect.y1 + 1,
    )
    page.add_redact_annot(clear_rect, fill=(1, 1, 1))
    page.apply_redactions()

    fontsize = style["size"]
    fontname = style["fontname"]
    color = style["color"]
    hard_limit = cell_x1 - cell_x0 - 2
    draw_width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
    for _ in range(32):
        if draw_width <= hard_limit:
            break
        fontsize = max(5.0, fontsize * (hard_limit / draw_width) * 0.98)
        draw_width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)

    old_center = (style["line_x0"] + style["line_x1"]) / 2
    cell_center = (cell_x0 + cell_x1) / 2
    if abs(old_center - cell_center) <= 2:
        x = cell_center - draw_width / 2
    else:
        x = style["line_x0"]
    x = max(cell_x0 + 2, min(x, cell_x1 - 2 - draw_width))
    if x + draw_width > cell_x1 - 1:
        fontsize = max(
            5.0,
            fontsize * ((cell_x1 - 1 - x) / draw_width) * 0.98,
        )
        draw_width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
        if abs(old_center - cell_center) <= 2:
            x = cell_center - draw_width / 2
        x = max(cell_x0 + 2, min(x, cell_x1 - 2 - draw_width))

    page.insert_text(
        (x, style["baseline"]),
        text,
        fontsize=fontsize,
        fontname=fontname,
        color=color,
    )


def replace_page_number(page, page_index: int, total_pages: int) -> None:
    """Reemplaza 'Página X de Y' redibujando la frase completa al estilo del membrete."""
    new_text = f"Página {page_index + 1} de {total_pages}"

    line_rect = _find_pagina_line_rect(page)
    if line_rect is not None:
        _render_pagination_in_cell(page, line_rect, new_text)
        return

    words = page.get_text("words")
    indices = _find_page_number_word_indices(words)
    if indices:
        start_idx, _, _, end_idx = indices
        if _words_on_same_line(words, start_idx, end_idx):
            union = _word_rect(words[start_idx])
            for i in range(start_idx + 1, end_idx + 1):
                union |= _word_rect(words[i])
            _render_pagination_in_cell(page, union, new_text)
            return

    for block in page.get_text("blocks"):
        if len(block) < 5:
            continue
        text = str(block[4]).strip()
        match = _PAGE_NUM_PHRASE_RE.search(text)
        if not match:
            continue
        rect = fitz.Rect(block[:4])
        line_height = max(8, rect.height * 0.35)
        line_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + line_height)
        _render_pagination_in_cell(page, line_rect, new_text)
        return


def _find_report_title_rect(page) -> fitz.Rect | None:
    old_title_re = re.compile(
        r"INFORME\s+DE\s+GESTI[ÓO]N\s+INSTITUCIONAL",
        re.IGNORECASE,
    )
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            line_text = "".join(span["text"] for span in line.get("spans", [])).strip()
            if old_title_re.search(line_text):
                return fitz.Rect(line["bbox"])
    for old_text in (
        "INFORME DE GESTIÓN INSTITUCIONAL",
        "INFORME DE GESTION INSTITUCIONAL",
    ):
        hits = page.search_for(old_text)
        if hits:
            return hits[0]
    return None


def _insert_report_title_text(page, rect: fitz.Rect, new_title: str) -> None:
    """Inserta título negro legible tras redactar el texto original del membrete."""
    expanded = fitz.Rect(rect.x0 - 18, rect.y0 - 5, rect.x1 + 18, rect.y1 + 8)
    page.add_redact_annot(expanded, fill=(1, 1, 1))
    page.apply_redactions()

    title_lines = (
        "INFORME DE INDICADORES\nPLAN DE DESARROLLO"
        if len(new_title) > 34
        else new_title
    )
    fontsize = max(7.5, min(9.5, expanded.height * 0.38))
    overflow = page.insert_textbox(
        expanded,
        title_lines,
        fontsize=fontsize,
        fontname="helv",
        color=(0, 0, 0),
        align=fitz.TEXT_ALIGN_CENTER,
    )
    if overflow >= 0:
        return

    page.draw_rect(expanded, color=(1, 1, 1), fill=(1, 1, 1))
    mid_x = (expanded.x0 + expanded.x1) / 2
    lines = title_lines.split("\n")
    step = expanded.height / (len(lines) + 1)
    for idx, line in enumerate(lines):
        y = expanded.y1 - step * (idx + 1)
        text_width = fitz.get_text_length(line, fontname="helv", fontsize=fontsize)
        page.insert_text(
            (mid_x - text_width / 2, y),
            line,
            fontsize=fontsize,
            fontname="helv",
            color=(0, 0, 0),
        )


def clear_report_title(page) -> None:
    """Oculta el título del membrete sin insertar texto de reemplazo."""
    rect = _find_report_title_rect(page)
    if rect is not None:
        expanded = fitz.Rect(rect.x0 - 18, rect.y0 - 5, rect.x1 + 18, rect.y1 + 8)
        page.add_redact_annot(expanded, fill=(1, 1, 1))
        page.apply_redactions()


def replace_report_title(page, new_title: str) -> None:
    """Reemplaza el título del membrete (p. ej. INFORME DE GESTIÓN INSTITUCIONAL)."""
    rect = _find_report_title_rect(page)
    if rect is not None:
        _insert_report_title_text(page, rect, new_title)


def load_entity_template(entity) -> bytes | None:
    """Descarga el membrete institucional desde B2 (bucket PQRS)."""
    if not getattr(entity, "pdf_template_url", None):
        return None
    try:
        key = entity.pdf_template_url.lstrip("/")
        client = get_b2_client()
        resp = client.get_object(Bucket=settings.B2_BUCKET_PQRS, Key=key)
        return resp["Body"].read()
    except Exception:
        logger.exception("Error descargando template PDF para entidad %s", getattr(entity, "id", None))
        return None


def apply_template_overlay(
    content_bytes: bytes,
    template_bytes: bytes,
    *,
    report_title: str | None = None,
) -> BytesIO:
    """Superpone el membrete institucional sobre el PDF de contenido."""
    content_doc = fitz.open(stream=content_bytes, filetype="pdf")
    total_pages = len(content_doc)

    for i, page in enumerate(content_doc):
        tpl_doc = fitz.open(stream=template_bytes, filetype="pdf")
        tpl_page = tpl_doc[0]
        if report_title:
            replace_report_title(tpl_page, report_title)
        else:
            clear_report_title(tpl_page)
        replace_page_number(tpl_page, i, total_pages)
        page.show_pdf_page(page.rect, tpl_doc, 0, overlay=False)
        tpl_doc.close()

    final_buffer = BytesIO()
    content_doc.save(final_buffer)
    content_doc.close()
    final_buffer.seek(0)
    return final_buffer
