"""Helpers compartidos para membrete PDF institucional (PQRS, PDM, etc.)."""
from __future__ import annotations

import logging
import re
from io import BytesIO

import fitz

from django.conf import settings

from apps.common.b2_client import get_b2_client

logger = logging.getLogger(__name__)


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
    page_num_re = re.compile(r"P[aá]gina\s+\d+\s+de\s+\d+", re.IGNORECASE)
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            line_text = "".join(span["text"] for span in line.get("spans", [])).strip()
            if page_num_re.search(line_text):
                bbox = line["bbox"]
                return fitz.Rect(bbox)
    return None


def _words_on_same_line(words: list, start_idx: int, end_idx: int, tolerance: float = 2.0) -> bool:
    y_values = [words[i][1] for i in range(start_idx, end_idx + 1)]
    return (max(y_values) - min(y_values)) <= tolerance


def _insert_page_number_text(page, rect: fitz.Rect, text: str) -> None:
    fontsize = max(7, min(14, rect.height * 0.95))
    page.insert_text(
        (rect.x0, rect.y1 - 1),
        text,
        fontsize=fontsize,
        color=(0, 0, 0),
        fontname="helv",
    )


def replace_page_number(page, page_index: int, total_pages: int) -> None:
    """Reemplaza la frase completa 'Página X de Y' en el membrete."""
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

    page_num_re = re.compile(r"P[aá]gina\s+\d+\s+de\s+\d+", re.IGNORECASE)
    for block in page.get_text("blocks"):
        if len(block) < 5:
            continue
        text = str(block[4]).strip()
        match = page_num_re.search(text)
        if not match:
            continue
        rect = fitz.Rect(block[:4])
        line_height = max(8, rect.height * 0.35)
        line_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + line_height)
        _cover_rect_white(page, line_rect, pad_x=4, pad_y=1)
        _insert_page_number_text(page, line_rect, new_text)
        return


def replace_report_title(page, new_title: str) -> None:
    """Reemplaza el título del membrete (p. ej. INFORME DE GESTIÓN INSTITUCIONAL)."""
    old_title_re = re.compile(
        r"INFORME\s+DE\s+GESTI[ÓO]N\s+INSTITUCIONAL",
        re.IGNORECASE,
    )
    data = page.get_text("dict")
    for block in data.get("blocks", []):
        for line in block.get("lines", []):
            line_text = "".join(span["text"] for span in line.get("spans", [])).strip()
            if not old_title_re.search(line_text):
                continue
            rect = fitz.Rect(line["bbox"])
            _cover_rect_white(page, rect, pad_x=10, pad_y=3)
            fontsize = max(7, min(10, rect.height * 0.82))
            page.insert_textbox(
                rect,
                new_title,
                fontsize=fontsize,
                fontname="helv",
                color=(0, 0, 0),
                align=fitz.TEXT_ALIGN_CENTER,
            )
            return

    for old_text in (
        "INFORME DE GESTIÓN INSTITUCIONAL",
        "INFORME DE GESTION INSTITUCIONAL",
    ):
        for rect in page.search_for(old_text):
            _cover_rect_white(page, rect, pad_x=10, pad_y=3)
            fontsize = max(7, min(10, rect.height * 0.82))
            page.insert_textbox(
                rect,
                new_title,
                fontsize=fontsize,
                fontname="helv",
                color=(0, 0, 0),
                align=fitz.TEXT_ALIGN_CENTER,
            )
            return


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
        replace_page_number(tpl_page, i, total_pages)
        page.show_pdf_page(page.rect, tpl_doc, 0, overlay=False)
        tpl_doc.close()

    final_buffer = BytesIO()
    content_doc.save(final_buffer)
    content_doc.close()
    final_buffer.seek(0)
    return final_buffer
