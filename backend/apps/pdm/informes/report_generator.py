"""Generador PDF del informe institucional de gestión PDM."""
from __future__ import annotations

import re
from datetime import datetime
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from apps.common.pdf_template import apply_template_overlay, detect_template_margins, load_entity_template
from apps.pdm.informes.charts import generate_pdm_charts

_MESES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)


def _esc(text: Any) -> str:
    s = str(text or "")
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _fmt_money(value: float) -> str:
    return f"${value:,.0f}"


def _fmt_pct(value: float) -> str:
    return f"{value:.1f}%"


class PdmReportGenerator:
    def __init__(
        self,
        *,
        entity,
        anio: int,
        analytics: dict[str, Any],
        stats: dict[str, Any],
        estado_stats: dict[str, int],
        productos_detalle: list[dict[str, Any]],
        ai_analysis: dict[str, Any],
        usuario_firmante=None,
        secretaria_nombre: str | None = None,
        nombre_plan: str | None = None,
    ) -> None:
        self.entity = entity
        self.anio = anio
        self.analytics = analytics
        self.stats = stats
        self.estado_stats = estado_stats
        self.productos_detalle = productos_detalle
        self.ai_analysis = ai_analysis
        self.usuario_firmante = usuario_firmante
        self.secretaria_nombre = secretaria_nombre
        self.nombre_plan = nombre_plan or "Plan de Desarrollo Municipal"
        self.styles = getSampleStyleSheet()
        self.story: list = []
        self.charts = generate_pdm_charts(analytics)

    def _p(self, text: str, style) -> None:
        self.story.append(Paragraph(_esc(text), style))

    def _render_text_block(self, text_or_list, style) -> None:
        lines = text_or_list if isinstance(text_or_list, list) else str(text_or_list).split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                continue
            line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
            line = re.sub(r"\*(.+?)\*", r"\1", line)
            line = re.sub(r"^#{1,6}\s*", "", line)
            line = re.sub(r"^[-•]\s+", "", line)
            line = re.sub(r"^\d+[\.):]\s+", "", line)
            if line.strip():
                self._p(line, style)
                self.story.append(Spacer(1, 0.06 * inch))

    def _table(self, data: list[list], col_widths=None) -> Table:
        t = Table(data, colWidths=col_widths, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return t

    def _add_chart(self, key: str, width: float = 6.5 * inch) -> None:
        buf = self.charts.get(key)
        if not buf:
            return
        buf.seek(0)
        img = RLImage(buf, width=width, height=width * 0.55)
        self.story.append(img)
        self.story.append(Spacer(1, 0.15 * inch))

    def _build_story(self) -> None:
        title = ParagraphStyle("Title", parent=self.styles["Heading1"], fontSize=16, alignment=TA_CENTER, spaceAfter=12)
        heading = ParagraphStyle("Heading", parent=self.styles["Heading2"], fontSize=13, spaceAfter=8)
        sub = ParagraphStyle("Sub", parent=self.styles["Heading3"], fontSize=11, spaceAfter=6)
        normal = ParagraphStyle("Normal", parent=self.styles["Normal"], fontSize=10, alignment=TA_JUSTIFY, spaceAfter=8)
        center = ParagraphStyle("Center", parent=normal, alignment=TA_CENTER)

        now = datetime.now()
        mes_gen = _MESES[now.month - 1]

        self._p("INFORME DE AVANCE DEL PLAN DE DESARROLLO MUNICIPAL", title)
        self._p(_esc(self.entity.name), ParagraphStyle("Entity", parent=title, fontSize=14))
        self._p(f"Vigencia {self.anio}", center)
        if self.secretaria_nombre:
            self._p(f"Dependencia: {self.secretaria_nombre}", center)
        self._p(f"{self.nombre_plan}", center)
        self._p(f"Generado en {mes_gen} de {now.year}", center)
        self.story.append(PageBreak())

        self._p("1. INTRODUCCIÓN", heading)
        intro = (
            f"El presente informe consolida el seguimiento al Plan Indicativo del Plan de Desarrollo Municipal "
            f"de {self.entity.name} para la vigencia {self.anio}. "
            f"Documenta el avance físico y financiero de los productos, la ejecución del plan de acción "
            f"y las evidencias registradas en el sistema de gestión PDM."
        )
        if self.secretaria_nombre:
            intro += f" El alcance corresponde a la dependencia {self.secretaria_nombre}."
        self._p(intro, normal)
        self.story.append(Spacer(1, 0.1 * inch))

        self._p("2. RESUMEN EJECUTIVO", heading)
        pres = self.analytics.get("presupuesto", {})
        pct_fin = 0.0
        if pres.get("pto_definitivo"):
            pct_fin = round((pres.get("pagos", 0) / pres["pto_definitivo"]) * 100, 1)
        resumen_items = [
            ["Indicador", "Valor"],
            ["Total productos", str(self.analytics.get("total_productos", 0))],
            ["Avance físico promedio", _fmt_pct(self.analytics.get("avance_global", 0))],
            ["Avance financiero (pagos / pto. definitivo)", _fmt_pct(pct_fin)],
            ["Presupuesto acumulado (plan)", _fmt_money(float(self.stats.get("presupuesto_total", 0)))],
            ["Productos completados", str(self.analytics.get("productos_al_100", 0))],
        ]
        ed = self.analytics.get("estado_distribucion", {})
        for key, label in [
            ("pendiente", "Pendientes"),
            ("en_progreso", "En progreso"),
            ("completado", "Completados"),
            ("por_ejecutar", "Por ejecutar"),
        ]:
            resumen_items.append([label, str(ed.get(key, 0))])
        self.story.append(self._table(resumen_items, [3.5 * inch, 2.5 * inch]))
        self.story.append(Spacer(1, 0.15 * inch))
        self._add_chart("estado_dona", 4 * inch)

        por_linea = self.analytics.get("por_linea", [])
        if por_linea:
            self._p("3. AVANCE POR LÍNEAS ESTRATÉGICAS", heading)
            rows = [["Producto / Línea", "Productos", "Avance (%)"]]
            for item in por_linea[:20]:
                rows.append([item.get("linea", ""), str(item.get("productos", 0)), _fmt_pct(item.get("avance_pct", 0))])
            self.story.append(self._table(rows, [3.5 * inch, 1 * inch, 1.2 * inch]))
            self.story.append(Spacer(1, 0.1 * inch))
            self._add_chart("por_linea")

        por_sector = self.analytics.get("por_sector_estado", [])
        if por_sector:
            self._p("4. AVANCE POR SECTORES MGA", heading)
            rows = [["Sector", "Productos", "Avance físico", "Avance financiero"]]
            for item in por_sector[:20]:
                rows.append(
                    [
                        item.get("sector", ""),
                        str(item.get("total", 0)),
                        _fmt_pct(item.get("avance_fisico_pct", 0)),
                        _fmt_pct(item.get("avance_financiero_pct", 0)),
                    ]
                )
            self.story.append(self._table(rows, [2.5 * inch, 0.9 * inch, 1.1 * inch, 1.1 * inch]))
            self.story.append(Spacer(1, 0.1 * inch))
            self._add_chart("por_sector")

        por_ods = self.analytics.get("por_ods", [])
        if por_ods:
            self._p("5. AVANCE POR ODS", heading)
            rows = [["ODS", "Productos", "Avance (%)", "Presupuesto"]]
            for item in por_ods[:20]:
                rows.append(
                    [
                        item.get("ods", ""),
                        str(item.get("productos", 0)),
                        _fmt_pct(item.get("avance_pct", 0)),
                        _fmt_money(float(item.get("presupuesto", 0))),
                    ]
                )
            self.story.append(self._table(rows, [2.2 * inch, 0.8 * inch, 1 * inch, 1.5 * inch]))
            self.story.append(Spacer(1, 0.1 * inch))
            self._add_chart("por_ods")

        pres_anio = self.analytics.get("presupuestal_por_anio", [])
        if pres_anio:
            self._p("6. EJECUCIÓN PRESUPUESTAL POR VIGENCIA", heading)
            self._add_chart("presupuestal")

        if self.productos_detalle:
            self._p("7. EJECUCIÓN DEL PLAN DE ACCIÓN", heading)
            for prod in self.productos_detalle:
                self._p(f"Producto {prod.get('codigo_producto', '')}", sub)
                if prod.get("indicador"):
                    self._p(f"Indicador: {prod['indicador']}", normal)
                meta_rows = [
                    ["Meta programada", "Meta ejecutada", "Avance", "Recursos ejecutados"],
                    [
                        str(prod.get("meta_programada", 0)),
                        str(prod.get("meta_ejecutada", 0)),
                        _fmt_pct(prod.get("avance_pct", 0)),
                        _fmt_money(float(prod.get("recursos_ejecutados", 0))),
                    ],
                ]
                self.story.append(self._table(meta_rows))
                self.story.append(Spacer(1, 0.08 * inch))
                if prod.get("responsable"):
                    self._p(f"Responsable: {prod['responsable']}", normal)
                actividades = prod.get("actividades", [])
                if actividades:
                    act_rows = [["Actividad", "Estado", "Meta", "Informe"]]
                    for act in actividades:
                        act_rows.append(
                            [
                                act.get("nombre", "")[:80],
                                act.get("estado", ""),
                                str(act.get("meta_ejecutar", 0)),
                                (act.get("descripcion") or act.get("informe") or "—")[:120],
                            ]
                        )
                    self.story.append(self._table(act_rows, [2 * inch, 0.9 * inch, 0.7 * inch, 2.4 * inch]))
                contratos = prod.get("contratos", [])
                if contratos:
                    self._p("Contratos RPS asociados:", sub)
                    ctr_rows = [["CRP", "Concepto", "Valor", "Contratista"]]
                    for c in contratos[:10]:
                        ctr_rows.append(
                            [
                                c.get("no_crp", ""),
                                (c.get("concepto") or "")[:60],
                                _fmt_money(float(c.get("valor", 0))),
                                (c.get("contratista") or "")[:40],
                            ]
                        )
                    self.story.append(self._table(ctr_rows, [0.8 * inch, 2.2 * inch, 1.2 * inch, 1.3 * inch]))
                for img_buf in prod.get("evidencia_imagenes", []):
                    try:
                        img_buf.seek(0)
                        self.story.append(RLImage(img_buf, width=3.5 * inch, height=2.5 * inch))
                        self.story.append(Spacer(1, 0.08 * inch))
                    except Exception:
                        pass
                self.story.append(Spacer(1, 0.12 * inch))

        self._p("8. CONCLUSIONES Y RECOMENDACIONES", heading)
        if self.ai_analysis.get("conclusiones"):
            self._p("Conclusiones", sub)
            self._render_text_block(self.ai_analysis["conclusiones"], normal)
        recs = self.ai_analysis.get("recomendaciones") or []
        if recs:
            self._p("Recomendaciones", sub)
            for i, rec in enumerate(recs[:6], 1):
                self._p(f"{i}. {rec}", normal)

        self._p("9. FIRMA", heading)
        firmante = self.usuario_firmante
        if firmante:
            nombre = getattr(firmante, "full_name", None) or getattr(firmante, "nombre", "") or str(firmante)
            cargo = getattr(firmante, "cargo", "") or ""
            self.story.append(Spacer(1, 0.5 * inch))
            self._p("_" * 40, center)
            self._p(nombre, center)
            if cargo:
                self._p(cargo, center)

    def _create_content_pdf(self, top_margin: float, bottom_margin: float) -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            topMargin=top_margin * inch,
            bottomMargin=bottom_margin * inch,
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
        )
        self._build_story()
        doc.build(self.story)
        buffer.seek(0)
        return buffer

    def generate_pdf(self) -> BytesIO:
        template_bytes = load_entity_template(self.entity)
        top_margin, bottom_margin = 1.6, 1.0
        if template_bytes:
            try:
                top_margin, bottom_margin = detect_template_margins(template_bytes)
            except Exception:
                template_bytes = None
        content = self._create_content_pdf(top_margin, bottom_margin)
        if not template_bytes:
            return content
        try:
            return apply_template_overlay(content.read(), template_bytes)
        except Exception:
            content.seek(0)
            return content
