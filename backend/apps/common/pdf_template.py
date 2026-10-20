"""Superposición de membrete PDF sobre contenido de informes."""
from __future__ import annotations

from io import BytesIO

import fitz


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


def apply_template_overlay(
    content_bytes: bytes,
    template_bytes: bytes,
) -> BytesIO:
    """Superpone el membrete (una o varias páginas) bajo el contenido."""
    content_doc = fitz.open(stream=content_bytes, filetype="pdf")
    tpl_doc = fitz.open(stream=template_bytes, filetype="pdf")
    tpl_len = len(tpl_doc)

    for i, page in enumerate(content_doc):
        if tpl_len == 1:
            tpl_idx = 0
        else:
            tpl_idx = min(i, tpl_len - 1)
        page.show_pdf_page(page.rect, tpl_doc, tpl_idx, overlay=False)

    tpl_doc.close()
    final_buffer = BytesIO()
    content_doc.save(final_buffer)
    content_doc.close()
    final_buffer.seek(0)
    return final_buffer

