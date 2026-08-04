"""Generador PDF — Informe de Seguimiento Planes Institucionales (Decreto 612)."""
from __future__ import annotations

import base64
from datetime import date
from io import BytesIO
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image as RLImage
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.common.report_cover import build_cover_flowables
from apps.common.report_theme import (
    BG_WHITE,
    LINE_MID,
    MPL_BAR,
    MPL_LINE,
    MPL_TEXT,
    ROW_ALT,
    TEXT_DARK,
    banner_style_cmds,
    table_style_cmds,
)
from apps.planes.informes import narrativa


class PlanesReportGenerator:
    REPORT_TITLE = "INFORME DE SEGUIMIENTO PLANES INSTITUCIONALES"
    REPORT_CODE = "FM-PLANES-612-001"

    COLOR_PRIMARY = TEXT_DARK
    COLOR_HEADER = TEXT_DARK
    COLOR_ROW_ALT = ROW_ALT
    TABLE_WIDTH = 7.0 * inch
    MAX_FLOWABLE_HEIGHT = 9.0 * inch

    def __init__(
        self,
        *,
        entity,
        informe,
        planes: list,
        actividades_por_plan: dict[int, list],
        anio: int,
        trimestre: int,
        trimestre_label: str,
        secretaria_nombre: str | None,
        stats: dict[str, Any],
        ai_analysis: dict[str, Any],
        firmante_nombre: str,
        cargo_firmante: str,
        incluir_evidencias: bool = True,
    ):
        self.entity = entity
        self.informe = informe
        self.planes = planes
        self.actividades_por_plan = actividades_por_plan
        self.anio = anio
        self.trimestre = trimestre
        self.trimestre_label = trimestre_label
        self.secretaria_nombre = secretaria_nombre
        self.stats = stats
        self.ai_analysis = ai_analysis or {}
        self.firmante_nombre = firmante_nombre
        self.cargo_firmante = cargo_firmante
        self.incluir_evidencias = incluir_evidencias
        self.narrativa_ctx = narrativa.build_narrativa_context(
            entity_name=entity.name,
            anio=anio,
            trimestre=trimestre,
            secretaria_nombre=secretaria_nombre,
            fecha_auditoria=date.today(),
        )
        self.buffer = BytesIO()
        self.doc = None
        self.styles = None
        self.story: list = []
        self._cache_graficas: dict[str, bytes] = {}

    def _institutional_styles(self) -> dict:
        if hasattr(self, "_inst_styles_cache"):
            return self._inst_styles_cache
        self._inst_styles_cache = {
            "banner": ParagraphStyle(
                "PlanesBanner",
                parent=self.styles["Normal"],
                textColor=colors.white,
                fontName="Helvetica-Bold",
                fontSize=10,
                alignment=TA_CENTER,
            ),
            "heading1": ParagraphStyle(
                "PlanesH1",
                parent=self.styles["Heading1"],
                fontSize=14,
                textColor=self.COLOR_HEADER,
                spaceBefore=12,
                spaceAfter=8,
                fontName="Helvetica-Bold",
            ),
            "body": ParagraphStyle(
                "PlanesBody",
                parent=self.styles["Normal"],
                fontSize=10,
                alignment=TA_JUSTIFY,
                leading=14,
                spaceAfter=8,
            ),
            "cell_center": ParagraphStyle(
                "PlanesCellCenter",
                parent=self.styles["Normal"],
                fontSize=8,
                alignment=TA_CENTER,
                leading=10,
            ),
            "cell_left": ParagraphStyle(
                "PlanesCellLeft",
                parent=self.styles["Normal"],
                fontSize=8,
                alignment=TA_LEFT,
                leading=10,
            ),
            "cell_right": ParagraphStyle(
                "PlanesCellRight",
                parent=self.styles["Normal"],
                fontSize=8,
                alignment=TA_RIGHT,
                leading=10,
            ),
        }
        return self._inst_styles_cache

    def add_header_footer(self, canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.drawString(0.5 * inch, 10.5 * inch, self.REPORT_CODE)
        canvas.drawString(0.5 * inch, 10.3 * inch, "Versión: 1.0")
        canvas.drawRightString(8 * inch, 10.5 * inch, f"Página {doc.page}")
        canvas.drawRightString(8 * inch, 10.3 * inch, self.REPORT_TITLE[:48])
        canvas.setStrokeColor(LINE_MID)
        canvas.setFillColor(TEXT_DARK)
        canvas.line(0.5 * inch, 10.2 * inch, 8 * inch, 10.2 * inch)
        canvas.setFont("Helvetica", 7)
        footer = f"Planes Institucionales D612 — {self.entity.name} — {self.trimestre_label} {self.anio}"
        canvas.drawCentredString(4.25 * inch, 0.5 * inch, footer)
        canvas.restoreState()

    def _append_banner(self, title: str) -> None:
        st = self._institutional_styles()
        table = Table(
            [[Paragraph(f"<b>{title}</b>", st["banner"])]],
            colWidths=[self.TABLE_WIDTH],
            splitByRow=True,
        )
        table.setStyle(TableStyle(banner_style_cmds()))
        self.story.append(table)

    def _append_heading(self, text: str) -> None:
        st = self._institutional_styles()
        self.story.append(Paragraph(text, st["heading1"]))

    def _append_paragraph(self, text: str) -> None:
        st = self._institutional_styles()
        self.story.append(Paragraph(text.replace("\n", "<br/>"), st["body"]))

    def _append_bullet_list(self, items: list[str]) -> None:
        st = self._institutional_styles()
        for item in items:
            self.story.append(Paragraph(f"• {item}", st["body"]))

    def _append_bar_chart(self, labels: list[str], values: list[float], title: str, cache_key: str) -> None:
        if not labels:
            return
        if cache_key not in self._cache_graficas:
            fig_h = max(3.0, min(6.0, len(labels) * 0.45))
            fig, ax = plt.subplots(figsize=(7, fig_h))
            fig.patch.set_facecolor("white")
            y_pos = range(len(labels))
            short_labels = [lbl[:40] + "…" if len(lbl) > 40 else lbl for lbl in labels]
            ax.barh(list(y_pos), values, color=MPL_BAR, height=0.6)
            ax.set_yticks(list(y_pos))
            ax.set_yticklabels(short_labels, fontsize=8, color=MPL_TEXT)
            ax.set_xlim(0, 100)
            ax.set_xlabel("Avance (%)", fontsize=9, color=MPL_TEXT)
            ax.set_title(title, fontsize=10, fontweight="bold", color=MPL_TEXT)
            ax.spines["top"].set_visible(False)
            ax.spines["right"].set_visible(False)
            ax.spines["left"].set_color(MPL_LINE)
            ax.spines["bottom"].set_color(MPL_LINE)
            ax.grid(axis="x", alpha=0.3, linestyle="--", color=MPL_LINE)
            ax.set_axisbelow(True)
            ax.tick_params(colors=MPL_TEXT)
            ax.invert_yaxis()
            fig.tight_layout()
            buf = BytesIO()
            fig.savefig(buf, format="png", dpi=120, bbox_inches="tight", facecolor="white")
            plt.close(fig)
            self._cache_graficas[cache_key] = buf.getvalue()

        img = RLImage(BytesIO(self._cache_graficas[cache_key]), width=6.5 * inch, height=min(4.5 * inch, len(labels) * 0.35 * inch + 1.5 * inch))
        self.story.append(img)
        self.story.append(Spacer(1, 0.15 * inch))

    def generate_portada(self) -> None:
        st = self._institutional_styles()
        normal_style = st["body"]
        period_text = f"{self.trimestre_label} — {self.anio}"

        extra: list = []
        sec_text = self.secretaria_nombre or "Dependencia con funciones de Control Interno"
        extra.append(Spacer(1, 0.4 * inch))
        extra.append(
            Paragraph(
                sec_text.upper(),
                ParagraphStyle("Sec", parent=st["body"], alignment=TA_CENTER, fontName="Helvetica-Bold", textColor=TEXT_DARK),
            )
        )
        extra.append(
            Paragraph(
                "con funciones de Control Interno",
                ParagraphStyle("Sec2", parent=st["body"], alignment=TA_CENTER, textColor=TEXT_DARK),
            )
        )

        cover = build_cover_flowables(
            title_line="Informe de Seguimiento",
            subtitle_line="Planes Institucionales decreto 612 de 2018",
            entity_name=self.narrativa_ctx["entity_upper"],
            period_text=period_text,
            normal_style=normal_style,
            top_spacer=1.5,
            extra_flowables=extra,
        )
        self.story.extend(cover)

    def generate_introduccion(self) -> None:
        self._append_heading("INTRODUCCIÓN")
        self._append_paragraph(narrativa.introduccion(self.narrativa_ctx))

    def generate_objetivo(self) -> None:
        self._append_heading("OBJETIVO")
        self._append_heading("Objetivo General.")
        self._append_paragraph(narrativa.objetivo_general(self.narrativa_ctx))
        self._append_heading("Objetivos Específicos.")
        self._append_bullet_list(narrativa.objetivos_especificos(self.narrativa_ctx))

    def generate_alcance(self) -> None:
        self._append_heading("ALCANCE")
        self._append_paragraph(narrativa.alcance(self.narrativa_ctx))

    def generate_fecha_auditoria(self) -> None:
        self._append_heading("FECHA DE LA AUDITORÍA")
        self._append_paragraph(narrativa.fecha_auditoria(self.narrativa_ctx))

    def generate_criterios(self) -> None:
        self._append_heading("CRITERIOS DE AUDITORÍA")
        self._append_paragraph(narrativa.criterios_auditoria())

    def generate_tipo_auditoria(self) -> None:
        self._append_heading("TIPO DE AUDITORÍA")
        self._append_paragraph(narrativa.tipo_auditoria())

    def generate_resumen_graficas(self) -> None:
        self._append_heading("RESUMEN DE AVANCE")
        avance_por_plan: list[tuple[str, float]] = []
        for plan in self.planes:
            acts = self.actividades_por_plan.get(plan.id, [])
            if not acts:
                continue
            avg = sum(getattr(a, "avance_calculado", a.avance) for a in acts) / len(acts)
            avance_por_plan.append((plan.catalogo.nombre, round(avg, 1)))
        if avance_por_plan:
            labels, values = zip(*avance_por_plan, strict=True)
            self._append_bar_chart(list(labels), list(values), "Avance por plan institucional (%)", "avance_planes")

    def generate_actividades_desarrolladas(self) -> None:
        self._append_heading("ACTIVIDADES DESARROLLADAS")
        st = self._institutional_styles()
        col_widths = [0.35 * inch, 1.5 * inch, 1.2 * inch, 0.65 * inch, 1.0 * inch, 1.3 * inch]
        headers = [
            "ITEM",
            "ACTIVIDAD PROGRAMADA",
            "ACTIVIDAD EJECUTADA",
            "% DE CUMPLIMIENTO",
            "PLAZO DE EJECUCIÓN",
            "RESPONSABLE",
        ]

        for plan in self.planes:
            acts = self.actividades_por_plan.get(plan.id, [])
            if not acts:
                continue
            self.story.append(Spacer(1, 0.15 * inch))
            self._append_banner(f"{plan.catalogo.codigo} — {plan.catalogo.nombre}")

            rows = [
                [Paragraph(f"<b>{h}</b>", st["cell_center" if i in (0, 3) else "cell_left"]) for i, h in enumerate(headers)],
            ]
            for idx, act in enumerate(acts, start=1):
                ejecutado = getattr(act, "total_ejecutado_val", 0)
                avance = getattr(act, "avance_calculado", act.avance)
                plazo = ""
                if act.fecha_inicio and act.fecha_fin:
                    plazo = f"{act.fecha_inicio.strftime('%d/%m/%Y')} — {act.fecha_fin.strftime('%d/%m/%Y')}"
                elif act.fecha_fin:
                    plazo = act.fecha_fin.strftime("%d/%m/%Y")
                resp = act.responsable_secretaria.nombre if act.responsable_secretaria_id else (
                    plan.responsable_secretaria_nombre or "—"
                )
                ultima_ev = act.evidencias.last()
                desc_ejec = ""
                if ultima_ev:
                    desc_ejec = ultima_ev.descripcion[:200]
                elif ejecutado:
                    desc_ejec = f"Ejecutado: {ejecutado}"
                rows.append(
                    [
                        Paragraph(str(idx), st["cell_right"]),
                        Paragraph(act.nombre[:300], st["cell_left"]),
                        Paragraph(desc_ejec or "—", st["cell_left"]),
                        Paragraph(f"{avance}%", st["cell_right"]),
                        Paragraph(plazo or "—", st["cell_left"]),
                        Paragraph(resp[:120], st["cell_left"]),
                    ]
                )

            table = Table(rows, colWidths=col_widths, repeatRows=1, splitByRow=True)
            table.setStyle(
                TableStyle(
                    table_style_cmds(
                        n_rows=len(rows),
                        numeric_cols=(0, 3),
                        left_cols=(1, 2, 4, 5),
                    )
                )
            )
            self.story.append(table)

            if self.incluir_evidencias:
                imgs: list[str] = []
                for act in acts:
                    imgs.extend(getattr(act, "imagenes_evidencia", [])[:2])
                if imgs:
                    self.story.append(Spacer(1, 0.1 * inch))
                    img_flowables = []
                    for data_uri in imgs[:4]:
                        try:
                            raw = base64.b64decode(data_uri.split(",", 1)[1])
                            img_flowables.append(RLImage(BytesIO(raw), width=2.2 * inch, height=2.2 * inch))
                        except Exception:
                            continue
                    if img_flowables:
                        row = img_flowables[:2]
                        while len(row) < 2 and len(img_flowables) > len(row):
                            row.append(Spacer(2.2 * inch, 2.2 * inch))
                        self.story.append(Table([row], colWidths=[2.4 * inch, 2.4 * inch]))

    def generate_resultados(self) -> None:
        self._append_heading("RESULTADOS DE LA AUDITORÍA")
        resultados = self.ai_analysis.get("resultados", "")
        conclusiones = self.ai_analysis.get("conclusiones", "")
        recomendaciones = self.ai_analysis.get("recomendaciones", [])
        if resultados:
            self._append_paragraph(resultados)
        if conclusiones:
            self._append_heading("CONCLUSIONES")
            self._append_paragraph(conclusiones)
        if recomendaciones:
            self._append_heading("RECOMENDACIONES")
            self._append_bullet_list(recomendaciones)

    def generate_firma(self) -> None:
        self.story.append(Spacer(1, 0.5 * inch))
        st = self._institutional_styles()
        if self.firmante_nombre:
            self.story.append(
                Paragraph(
                    self.firmante_nombre.upper(),
                    ParagraphStyle("Firma", parent=st["body"], alignment=TA_CENTER, fontName="Helvetica-Bold"),
                )
            )
        if self.cargo_firmante:
            self.story.append(
                Paragraph(self.cargo_firmante, ParagraphStyle("Cargo", parent=st["body"], alignment=TA_CENTER))
            )

    def _build_content_pdf(self, *, top_margin: float, bottom_margin: float, use_template: bool) -> bytes:
        self.buffer = BytesIO()
        self.doc = SimpleDocTemplate(
            self.buffer,
            pagesize=letter,
            rightMargin=0.5 * inch,
            leftMargin=0.5 * inch,
            topMargin=top_margin,
            bottomMargin=bottom_margin,
        )
        self.styles = getSampleStyleSheet()
        self.story = []

        self.generate_portada()
        self.generate_introduccion()
        self.generate_objetivo()
        self.generate_alcance()
        self.generate_fecha_auditoria()
        self.generate_criterios()
        self.generate_tipo_auditoria()
        self.generate_resumen_graficas()
        self.generate_actividades_desarrolladas()
        self.generate_resultados()
        self.generate_firma()

        if use_template:
            self.doc.build(self.story)
        else:
            self.doc.build(
                self.story,
                onFirstPage=self.add_header_footer,
                onLaterPages=self.add_header_footer,
            )
        pdf_bytes = self.buffer.getvalue()
        self.buffer.close()
        return pdf_bytes

    def generate_pdf(self) -> BytesIO:
        from apps.common.pdf_template import (
            apply_template_overlay,
            detect_template_margins,
            load_entity_template,
        )

        template_pdf_bytes = load_entity_template(self.entity)
        top_margin = 0.8 * inch
        bottom_margin = 0.8 * inch
        use_template = False

        if template_pdf_bytes:
            try:
                top_in, bottom_in = detect_template_margins(template_pdf_bytes)
                top_margin = top_in * inch
                bottom_margin = bottom_in * inch
                use_template = True
            except Exception:
                template_pdf_bytes = None

        pdf_bytes = self._build_content_pdf(
            top_margin=top_margin,
            bottom_margin=bottom_margin,
            use_template=use_template,
        )

        if template_pdf_bytes:
            try:
                return apply_template_overlay(
                    pdf_bytes,
                    template_pdf_bytes,
                    report_title=self.REPORT_TITLE,
                )
            except Exception:
                pass

        buffer = BytesIO(pdf_bytes)
        buffer.seek(0)
        return buffer
