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


def _redact_tight(page, rect: fitz.Rect) -> None:
    pad = 0.5
    tight = fitz.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad)
    page.add_redact_annot(tight)
    page.apply_redactions()


def _insert_at_word(page, word, text: str) -> None:
    rect = _word_rect(word)
    fontsize = max(7, min(14, rect.height * 0.9))
    page.insert_text(
        (rect.x0, rect.y1 - 1),
        str(text),
        fontsize=fontsize,
        color=(0, 0, 0),
        fontname="helv",
    )


def replace_page_number(page, page_index: int, total_pages: int) -> None:
    """Actualiza solo los dígitos de 'Página X de Y' en el membrete."""
    words = page.get_text("words")
    indices = _find_page_number_word_indices(words)
    if indices:
        _, num_a_idx, _, num_b_idx = indices
        num_word_a = words[num_a_idx]
        num_word_b = words[num_b_idx]
        _redact_tight(page, _word_rect(num_word_a))
        _redact_tight(page, _word_rect(num_word_b))
        _insert_at_word(page, num_word_a, page_index + 1)
        _insert_at_word(page, num_word_b, total_pages)
        return

    page_num_re = re.compile(r"P[aá]gina\s+\d+\s+de\s+\d+", re.IGNORECASE)
    for block in page.get_text("blocks"):
        if len(block) < 5:
            continue
        text = str(block[4]).strip()
        if not page_num_re.search(text):
            continue
        rect = fitz.Rect(block[:4])
        _redact_tight(page, rect)
        fontsize = max(7, min(14, rect.height * 0.9))
        page.insert_text(
            (rect.x0, rect.y1 - 1),
            f"Página {page_index + 1} de {total_pages}",
            fontsize=fontsize,
            color=(0, 0, 0),
            fontname="helv",
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


def apply_template_overlay(content_bytes: bytes, template_bytes: bytes) -> BytesIO:
    """Superpone el membrete institucional sobre el PDF de contenido."""
    content_doc = fitz.open(stream=content_bytes, filetype="pdf")
    total_pages = len(content_doc)

    for i, page in enumerate(content_doc):
        tpl_doc = fitz.open(stream=template_bytes, filetype="pdf")
        tpl_page = tpl_doc[0]
        replace_page_number(tpl_page, i, total_pages)
        page.show_pdf_page(page.rect, tpl_doc, 0, overlay=False)
        tpl_doc.close()

    final_buffer = BytesIO()
    content_doc.save(final_buffer)
    content_doc.close()
    final_buffer.seek(0)
    return final_buffer
