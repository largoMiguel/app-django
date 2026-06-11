"""OCR para escaneados e imágenes (Tesseract local, costo $0)."""
from __future__ import annotations

import logging
from io import BytesIO

logger = logging.getLogger(__name__)


def extract_text_from_image(content: bytes) -> str:
    """Extrae texto de imagen con Tesseract OCR."""
    try:
        from PIL import Image
        import pytesseract

        img = Image.open(BytesIO(content))
        text = pytesseract.image_to_string(img, lang="spa")
        return (text or "").strip()
    except ImportError:
        logger.warning("pytesseract o Pillow no instalados; OCR no disponible.")
        return ""
    except Exception as exc:  # noqa: BLE001
        logger.warning("OCR falló: %s", exc)
        return ""


def extract_text_from_pdf_scanned(content: bytes) -> str:
    """Intenta OCR en PDF escaneado (páginas como imágenes)."""
    try:
        from pdf2image import convert_from_bytes
        import pytesseract

        images = convert_from_bytes(content, dpi=200, first_page=1, last_page=5)
        parts = [pytesseract.image_to_string(img, lang="spa") for img in images]
        return "\n".join(p.strip() for p in parts if p.strip())
    except ImportError:
        logger.warning("pdf2image no instalado; OCR PDF no disponible.")
        return ""
    except Exception as exc:  # noqa: BLE001
        logger.warning("OCR PDF falló: %s", exc)
        return ""
