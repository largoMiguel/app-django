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


def _pagination_cell_right_edge(page, line_rect: fitz.Rect) -> float:
    right = page.rect.x1 - 12
    tol_y = max(6.0, line_rect.height * 2.5)
    for draw in page.get_drawings():
        rect = draw.get("rect")
        if rect is None:
            continue
        if rect.width > 4:
            continue
        if rect.y1 < line_rect.y0 - tol_y or rect.y0 > line_rect.y1 + tol_y:
            continue
        x = float(rect.x0)
        if x > line_rect.x0 + 8 and x < right:
            right = x
    return max(right, line_rect.x1 + 4)


def _fit_pagination_fontsize(
    fontsize: float,
    *,
    new_a: str,
    new_b: str,
    font_a: str,
    font_b: str,
    num_a_x0: float,
    de_rect: fitz.Rect,
    num_b_x0: float,
    cell_right: float,
) -> float:
    size = fontsize
    for _ in range(24):
        w_a = fitz.get_text_length(new_a, fontname=font_a, fontsize=size)
        w_b = fitz.get_text_length(new_b, fontname=font_b, fontsize=size)
        limit_a = max(4.0, de_rect.x0 - 2.0 - num_a_x0)
        limit_b = max(4.0, cell_right - 2.0 - num_b_x0)
        if w_a <= limit_a and w_b <= limit_b:
            return max(5.5, size)
        scale = 1.0
        if w_a > limit_a:
            scale = min(scale, limit_a / w_a)
        if w_b > limit_b:
            scale = min(scale, limit_b / w_b)
        size = max(5.5, size * scale * 0.97)
    return max(5.5, size)


def _insert_styled_text(
    page,
    origin: tuple[float, float],
    text: str,
    *,
    fontsize: float,
    fontname: str,
    color: tuple[float, float, float],
) -> None:
    page.insert_text(
        origin,
        text,
        fontsize=fontsize,
        fontname=fontname,
        color=color,
    )


def _replace_pagination_numbers_only(page, page_index: int, total_pages: int) -> bool:
    """Sustituye solo los dígitos, conservando 'Página' y 'de' del membrete original."""
    words = page.get_text("words")
    indices = _find_page_number_word_indices(words)
    if indices is None:
        return False
    start_idx, num_a_idx, de_idx, num_b_idx = indices
    if not _words_on_same_line(words, start_idx, num_b_idx):
        return False

    new_a = str(page_index + 1)
    new_b = str(total_pages)
    num_a_rect = _word_rect(words[num_a_idx])
    num_b_rect = _word_rect(words[num_b_idx])
    de_rect = _word_rect(words[de_idx])
    line_rect = _find_pagina_line_rect(page) or (num_a_rect | num_b_rect)

    style_a = _style_for_rect(page, num_a_rect)
    style_b = _style_for_rect(page, num_b_rect)
    fontsize = min(style_a["size"], style_b["size"])
    cell_right = _pagination_cell_right_edge(page, line_rect)
    fontsize = _fit_pagination_fontsize(
        fontsize,
        new_a=new_a,
        new_b=new_b,
        font_a=style_a["fontname"],
        font_b=style_b["fontname"],
        num_a_x0=num_a_rect.x0,
        de_rect=de_rect,
        num_b_x0=num_b_rect.x0,
        cell_right=cell_right,
    )

    _cover_rect_white(page, num_a_rect, pad_x=2, pad_y=1)
    _cover_rect_white(page, num_b_rect, pad_x=2, pad_y=1)
    baseline = num_a_rect.y1 - 1
    _insert_styled_text(
        page,
        (num_a_rect.x0, baseline),
        new_a,
        fontsize=fontsize,
        fontname=style_a["fontname"],
        color=style_a["color"],
    )
    _insert_styled_text(
        page,
        (num_b_rect.x0, baseline),
        new_b,
        fontsize=fontsize,
        fontname=style_b["fontname"],
        color=style_b["color"],
    )
    return True


def _insert_page_number_text(page, rect: fitz.Rect, text: str) -> None:
    """Respaldo: reescribe la frase completa ajustada al ancho de la celda."""
    style = _style_for_rect(page, rect)
    fontsize = style["size"]
    fontname = style["fontname"]
    color = style["color"]
    cell_right = _pagination_cell_right_edge(page, rect)
    available = max(rect.width, cell_right - rect.x0)
    text_width = fitz.get_text_length(text, fontname=fontname, fontsize=fontsize)
    if text_width > available and text_width > 0:
        fontsize = max(5.5, fontsize * (available / text_width))
    page.insert_text(
        (rect.x0, rect.y1 - 1),
        text,
        fontsize=fontsize,
        color=color,
        fontname=fontname,
    )


def replace_page_number(page, page_index: int, total_pages: int) -> None:
    """Reemplaza 'Página X de Y' conservando el estilo del membrete cuando es posible."""
    if _replace_pagination_numbers_only(page, page_index, total_pages):
        return

    new_text = f"Página {page_index + 1} de {total_pages}"

    line_rect = _find_pagina_line_rect(page)
    if line_rect is not None:
        _cover_rect_white(page, line_rect, pad_x=4, pad_y=1)
        _insert_page_number_text(page, line_rect, new_text)
        return

    words = page.get_text("words")
    indices = _find_page_number_word_indices(words)
    if indices:
        start_idx, _, _, end_idx = indices
        if _words_on_same_line(words, start_idx, end_idx):
            union = _word_rect(words[start_idx])
            for i in range(start_idx + 1, end_idx + 1):
                union |= _word_rect(words[i])
            _cover_rect_white(page, union, pad_x=4, pad_y=1)
            _insert_page_number_text(page, union, new_text)
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
        _cover_rect_white(page, line_rect, pad_x=4, pad_y=1)
        _insert_page_number_text(page, line_rect, new_text)
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
