#!/usr/bin/env python3
"""Genera un PDF de prueba con membrete y paginación (opcional: ruta a PDF real)."""
from __future__ import annotations

import os
import sys

import fitz

# Permite ejecutar desde la raíz del repo sin Django.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from apps.common.pdf_template import apply_template_overlay  # noqa: E402


def main() -> int:
    template_path = os.environ.get("MEMBRETE_PDF")
    if template_path:
        with open(template_path, "rb") as fh:
            template_bytes = fh.read()
    else:
        from apps.common.tests.test_pdf_template_pagination import _make_informe_style_template

        template_bytes = _make_informe_style_template()

    total = int(os.environ.get("PAGES", "75"))
    content = fitz.open()
    for _ in range(total):
        content.new_page(width=595, height=842)
    out = apply_template_overlay(content.tobytes(), template_bytes)
    content.close()

    output = os.environ.get("OUTPUT", "/tmp/membrete_pagination_test.pdf")
    with open(output, "wb") as fh:
        fh.write(out.getvalue())
    print(f"PDF generado: {output} ({total} páginas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
