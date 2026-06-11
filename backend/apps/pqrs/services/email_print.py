"""Documento imprimible estilo Gmail (Imprimir todo) para correos PQRS."""
from __future__ import annotations

import html
import logging
from datetime import datetime
from typing import Any

from apps.common.datetime_fmt import format_fecha_hora_co

logger = logging.getLogger(__name__)


def _escape_multiline(value: str) -> str:
    return html.escape(value or "").replace("\n", "<br>\n")


def build_gmail_print_html(
    *,
    from_name: str = "",
    from_email: str = "",
    to_emails: list[str] | None = None,
    subject: str = "",
    body: str = "",
    date: datetime | None = None,
    radicado: str = "",
) -> str:
    """HTML con apariencia de Gmail → Imprimir todo."""
    from_line = from_email
    if from_name and from_email:
        from_line = f"{html.escape(from_name)} &lt;{html.escape(from_email)}&gt;"
    elif from_name:
        from_line = html.escape(from_name)
    elif from_email:
        from_line = html.escape(from_email)
    else:
        from_line = "—"

    to_line = html.escape(", ".join(to_emails or []) or "—")
    date_line = html.escape(format_fecha_hora_co(date) if date else "—")
    subject_line = html.escape(subject or "(sin asunto)")
    body_html = _escape_multiline(body)
    radicado_badge = (
        f'<div class="radicado">Radicado interno: {html.escape(radicado)}</div>'
        if radicado
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>{subject_line}</title>
<style>
  @page {{ margin: 18mm 16mm; }}
  body {{
    font-family: "Google Sans", Roboto, Arial, sans-serif;
    font-size: 13px;
    color: #202124;
    background: #fff;
    margin: 0;
    padding: 24px;
    line-height: 1.5;
  }}
  .thread {{ max-width: 820px; margin: 0 auto; }}
  .subject {{
    font-size: 22px; font-weight: 400; color: #202124;
    margin: 0 0 20px; word-break: break-word;
  }}
  .meta {{
    border-bottom: 1px solid #e8eaed;
    padding-bottom: 16px; margin-bottom: 20px;
  }}
  .meta-row {{ display: flex; gap: 12px; margin: 4px 0; font-size: 13px; }}
  .meta-label {{ width: 52px; flex-shrink: 0; color: #5f6368; font-weight: 500; }}
  .meta-value {{ color: #202124; word-break: break-word; }}
  .message {{ font-size: 14px; color: #202124; white-space: normal; word-wrap: break-word; }}
  .radicado {{
    margin-top: 28px; padding-top: 12px; border-top: 1px dashed #dadce0;
    font-size: 11px; color: #5f6368;
  }}
  @media print {{ body {{ padding: 0; }} }}
</style>
</head>
<body>
<div class="thread">
  <h1 class="subject">{subject_line}</h1>
  <div class="meta">
    <div class="meta-row"><span class="meta-label">de:</span><span class="meta-value">{from_line}</span></div>
    <div class="meta-row"><span class="meta-label">para:</span><span class="meta-value">{to_line}</span></div>
    <div class="meta-row"><span class="meta-label">fecha:</span><span class="meta-value">{date_line}</span></div>
  </div>
  <div class="message">{body_html}</div>
  {radicado_badge}
</div>
<script>window.onload=function(){{window.print()}};</script>
</body>
</html>"""


def _pdf_safe(text: str) -> str:
    return (text or "").encode("latin-1", errors="replace").decode("latin-1")


def _from_display(from_name: str, from_email: str) -> str:
    if from_name and from_email:
        return f"{from_name} <{from_email}>"
    return from_name or from_email or "—"


def create_gmail_style_pdf(
    *,
    body: str,
    subject: str,
    radicado: str,
    from_name: str = "",
    from_email: str = "",
    to_emails: list[str] | None = None,
    date: datetime | None = None,
) -> bytes:
    """PDF con cabeceras de correo (de/para/fecha) estilo Gmail print."""
    from fpdf import FPDF

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_margins(18, 18, 18)

    pdf.set_font("Helvetica", size=16)
    pdf.multi_cell(0, 8, _pdf_safe(subject or "(sin asunto)"))
    pdf.ln(4)

    pdf.set_draw_color(232, 234, 237)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(6)

    pdf.set_font("Helvetica", size=10)
    meta_rows = [
        ("de:", _from_display(from_name, from_email)),
        ("para:", ", ".join(to_emails or []) or "—"),
        ("fecha:", format_fecha_hora_co(date) if date else "—"),
    ]
    for label, value in meta_rows:
        pdf.set_text_color(95, 99, 104)
        pdf.cell(14, 6, _pdf_safe(label), new_x="RIGHT")
        pdf.set_text_color(32, 33, 36)
        pdf.multi_cell(0, 6, _pdf_safe(value))
        pdf.ln(1)

    pdf.ln(4)
    pdf.set_draw_color(232, 234, 237)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(6)

    pdf.set_font("Helvetica", size=11)
    pdf.set_text_color(32, 33, 36)
    pdf.multi_cell(0, 6, _pdf_safe(body))

    if radicado:
        pdf.ln(8)
        pdf.set_draw_color(218, 220, 224)
        pdf.line(18, pdf.get_y(), 192, pdf.get_y())
        pdf.ln(4)
        pdf.set_font("Helvetica", size=9)
        pdf.set_text_color(95, 99, 104)
        pdf.cell(0, 5, _pdf_safe(f"Radicado interno: {radicado}"), new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


def create_email_print_document(
    *,
    body: str,
    subject: str,
    radicado: str,
    from_name: str = "",
    from_email: str = "",
    to_emails: list[str] | None = None,
    date: datetime | None = None,
) -> tuple[bytes, str, str]:
    """Genera PDF estilo Gmail print; HTML como respaldo si falla fpdf."""
    try:
        pdf_bytes = create_gmail_style_pdf(
            body=body,
            subject=subject,
            radicado=radicado,
            from_name=from_name,
            from_email=from_email,
            to_emails=to_emails,
            date=date,
        )
        return pdf_bytes, f"solicitud_{radicado}.pdf", "application/pdf"
    except Exception as exc:  # noqa: BLE001
        logger.warning("PDF estilo Gmail falló (%s); usando HTML.", exc)
        html_doc = build_gmail_print_html(
            from_name=from_name,
            from_email=from_email,
            to_emails=to_emails,
            subject=subject,
            body=body,
            date=date,
            radicado=radicado,
        )
        return html_doc.encode("utf-8"), f"solicitud_{radicado}.html", "text/html; charset=utf-8"


def email_meta_from_forward(forward_meta: Any, *, entity_email: str = "") -> dict[str, Any]:
    """Extrae metadatos de ForwardedEmailMeta para impresión."""
    to_emails = list(getattr(forward_meta, "to_emails", None) or [])
    from_email = getattr(forward_meta, "from_email", None) or ""
    if entity_email and entity_email.lower() not in {e.lower() for e in to_emails}:
        to_emails = [entity_email, *to_emails]
    return {
        "from_name": getattr(forward_meta, "from_name", None) or "",
        "from_email": from_email,
        "to_emails": to_emails,
        "subject": getattr(forward_meta, "subject", None) or "",
    }
