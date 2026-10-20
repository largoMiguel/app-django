"""Convierte el membrete Word de una entidad a PDF para revisión visual."""
from __future__ import annotations

import fitz
from django.core.management.base import BaseCommand, CommandError

from apps.common.docx_template import (
    analyze_docx_fonts,
    load_entity_docx_template,
    render_template_pdf,
)
from apps.entities.models import Entity


class Command(BaseCommand):
    help = "Genera PDF (y opcional PNG del encabezado) del membrete .docx de una entidad."

    def add_arguments(self, parser):
        parser.add_argument("slug", help="Slug de la entidad (ej. sachica)")
        parser.add_argument("--pages", type=int, default=1, help="Número de páginas del membrete")
        parser.add_argument("--out", default="/tmp/membrete.pdf", help="Ruta del PDF de salida")
        parser.add_argument(
            "--png",
            action="store_true",
            help="Guarda también un PNG recortando la zona superior del membrete",
        )
        parser.add_argument(
            "--png-out",
            default="/tmp/membrete_header.png",
            help="Ruta del PNG (solo con --png)",
        )

    def handle(self, *args, **options):
        slug = options["slug"]
        pages = max(1, int(options["pages"]))
        out_path = options["out"]

        try:
            entity = Entity.objects.get(slug=slug)
        except Entity.DoesNotExist as exc:
            raise CommandError(f"No existe entidad con slug={slug!r}") from exc

        docx_bytes = load_entity_docx_template(entity)
        if not docx_bytes:
            raise CommandError(f"La entidad {slug} no tiene membrete .docx configurado.")

        fonts, missing = analyze_docx_fonts(docx_bytes)
        self.stdout.write(f"Fuentes en el documento: {', '.join(fonts) or '(ninguna explícita)'}")
        if missing:
            self.stdout.write(self.style.WARNING(
                f"Fuentes sin sustituto métrico: {', '.join(missing)}"
            ))
        else:
            self.stdout.write(self.style.SUCCESS("Todas las fuentes tienen sustituto en el servidor."))

        pdf_bytes = render_template_pdf(docx_bytes, pages)
        with open(out_path, "wb") as fh:
            fh.write(pdf_bytes)
        self.stdout.write(self.style.SUCCESS(f"PDF generado: {out_path} ({pages} pág.)"))

        if options["png"]:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page = doc[0]
            clip = fitz.Rect(0, 0, page.rect.width, min(page.rect.height * 0.22, 220))
            pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(2, 2))
            pix.save(options["png_out"])
            doc.close()
            self.stdout.write(self.style.SUCCESS(f"PNG encabezado: {options['png_out']}"))
