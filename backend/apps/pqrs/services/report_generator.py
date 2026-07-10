"""
Generador de Informes de PQRS en PDF con overlay de template institucional
Genera PDFs con análisis estadístico, gráficos y puede usar template PDF personalizado

Características:
- Generación de gráficos con matplotlib (backend)
- Overlay de template PDF institucional (membrete)
- Análisis con IA opcional (OpenAI)
- Exportación a S3
- Estructura profesional con tablas e indicadores
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image as RLImage, Frame, PageTemplate, KeepTogether
)
from reportlab.platypus.doctemplate import BaseDocTemplate
from reportlab.lib.utils import ImageReader
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Any, Optional
import tempfile
import os
import re

import fitz  # PyMuPDF

# Configurar matplotlib para uso en servidor
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects
import numpy as np
from matplotlib import patches
plt.rcParams['font.family'] = 'DejaVu Sans'

class PQRSReportGenerator:
    """Generador de informes PQRS con overlay de template institucional"""
    
    def __init__(
        self,
        entity,
        pqrs_list: List,
        analytics: Dict[str, Any],
        ai_analysis: Optional[Dict[str, Any]] = None,
        fecha_inicio: str = None,
        fecha_fin: str = None,
        usuario_firmante = None
    ):
        self.entity = entity
        self.pqrs_list = pqrs_list
        self.analytics = analytics
        self.ai_analysis = ai_analysis or self._default_analysis()
        self.fecha_inicio = fecha_inicio
        self.fecha_fin = fecha_fin
        self.usuario_firmante = usuario_firmante
        self.buffer = BytesIO()
        self.styles = getSampleStyleSheet()
        self.story = []
        
    def _render_text_block(self, text_or_list, style, story=None):
        """Renderiza texto de IA en el PDF, manejando saltos de línea y markdown."""
        import re
        if story is None:
            story = self.story
        from reportlab.platypus import Spacer
        from reportlab.lib.units import inch

        lines = text_or_list if isinstance(text_or_list, list) else str(text_or_list).split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Eliminar markdown: **bold**, *italic*, ## headers, - bullets, • bullets
            line = re.sub(r'\*\*(.+?)\*\*', r'\1', line)
            line = re.sub(r'\*(.+?)\*', r'\1', line)
            line = re.sub(r'^#{1,6}\s*', '', line)
            line = re.sub(r'^[-•]\s+', '', line)
            # Quitar numeración tipo "1.", "2)", "Recomendación 1:", etc.
            line = re.sub(r'^\d+[\.):]\s+', '', line)
            line = re.sub(r'^Recomendaci[oó]n\s+\d+[:.)]?\s*', '', line, flags=re.IGNORECASE)
            # Escapar caracteres XML problemáticos para ReportLab
            line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            if line.strip():
                try:
                    from reportlab.platypus import Paragraph as RLParagraph
                    story.append(RLParagraph(line, style))
                    story.append(Spacer(1, 0.06 * inch))
                except Exception:
                    pass

    def _default_analysis(self) -> Dict[str, Any]:
        """Análisis por defecto cuando no hay IA"""
        return {
            "introduccion": "Informe generado automáticamente del sistema de PQRS.",
            "analisisGeneral": "Análisis estadístico de las PQRS registradas en el período seleccionado.",
            "analisisTiempos": "",
            "recomendaciones": [
                "Continuar con el seguimiento periódico de las PQRS",
                "Mantener los tiempos de respuesta dentro de los estándares",
                "Fortalecer los canales de comunicación con los ciudadanos"
            ],
            "conclusiones": "Las PQRS reflejan la interacción entre la ciudadanía y la entidad."
        }
    
    def _calcular_trimestre(self) -> Dict[str, Any]:
        """
        Calcula el trimestre basado en las fechas del informe.
        Retorna el número de trimestre, fechas de inicio y fin del periodo.
        """
        from datetime import datetime
        
        # Parsear fechas
        fecha_inicio = datetime.strptime(self.fecha_inicio, '%Y-%m-%d')
        fecha_fin = datetime.strptime(self.fecha_fin, '%Y-%m-%d')
        
        # Determinar trimestre basado en el mes de inicio
        mes_inicio = fecha_inicio.month
        
        if 1 <= mes_inicio <= 3:
            trimestre = 1
            texto_periodo = "1° PERIODO (01 de enero a 31 de marzo"
        elif 4 <= mes_inicio <= 6:
            trimestre = 2
            texto_periodo = "2° PERIODO (01 de abril a 30 de junio"
        elif 7 <= mes_inicio <= 9:
            trimestre = 3
            texto_periodo = "3° PERIODO (01 de julio a 30 de septiembre"
        else:  # 10-12
            trimestre = 4
            texto_periodo = "4° PERIODO (01 de octubre a 31 de diciembre"
        
        # Año del informe
        año = fecha_inicio.year
        
        return {
            'trimestre': trimestre,
            'texto_periodo': f"{texto_periodo}",
            'año': str(año)
        }
    
    def generate_charts(self) -> Dict[str, BytesIO]:
        """
        Genera gráficos estadísticos avanzados con matplotlib
        Retorna diccionario con buffers de imágenes PNG
        """
        charts = {}
        print(f"📊 Generando gráficas con {len(self.pqrs_list)} PQRS...")
        
        # Gráfico 1: Distribución por Estado (Pie Chart mejorado)
        fig1, ax1 = plt.subplots(figsize=(8, 6), facecolor='white')
        estados_labels = []
        valores_estados = []
        colores_estados = []
        
        # Obtener datos reales de analytics con colores profesionales
        data_estados = [
            ('Pendientes', self.analytics.get('pendientes', 0), '#3498db'),
            ('En Proceso', self.analytics.get('enProceso', 0), '#f39c12'),
            ('Respondidas', self.analytics.get('resueltas', 0), '#2ecc71'),
            ('Cerradas', self.analytics.get('cerradas', 0), '#95a5a6'),
        ]
        
        # Filtrar solo valores > 0 para mejor visualización
        for label, valor, color in data_estados:
            if valor > 0:
                estados_labels.append(f'{label}\n({valor})')
                valores_estados.append(valor)
                colores_estados.append(color)
        
        if valores_estados:
            # Explotar levemente el primer segmento
            explode = [0.08 if i == 0 else 0.03 for i in range(len(valores_estados))]
            
            wedges, texts, autotexts = ax1.pie(
                valores_estados, 
                explode=explode,
                labels=estados_labels, 
                autopct='%1.1f%%',
                colors=colores_estados, 
                startangle=45,
                shadow=True,  # Sombra para profundidad
                textprops={'fontsize': 11, 'weight': 'bold'},
                wedgeprops={'edgecolor': 'white', 'linewidth': 2.5, 'antialiased': True}
            )
            
            # Mejorar visibilidad de porcentajes con efecto de contraste
            for autotext in autotexts:
                autotext.set_color('white')
                autotext.set_fontsize(12)
                autotext.set_weight('bold')
                autotext.set_path_effects([
                    matplotlib.patheffects.withStroke(linewidth=2, foreground='black', alpha=0.3)
                ])
        else:
            ax1.text(0.5, 0.5, 'Sin datos disponibles', 
                    ha='center', va='center', transform=ax1.transAxes,
                    fontsize=12, color='gray')
        
        ax1.set_title(f"Distribución por Estado (Total: {self.analytics.get('totalPqrs', 0)})", 
                     fontsize=14, fontweight='bold', pad=25, color='#2c3e50')
        
        buffer1 = BytesIO()
        plt.savefig(buffer1, format='png', dpi=150, bbox_inches='tight')
        buffer1.seek(0)
        charts['estados'] = buffer1
        plt.close(fig1)
        
        # Gráfico 2: Distribución por Tipo (Bar Chart mejorado)
        fig2, ax2 = plt.subplots(figsize=(10, 6), facecolor='white')
        tipos_pqrs = self.analytics.get('tiposPqrs', {})
        
        if tipos_pqrs:
            # Ordenar por cantidad (mayor a menor)
            tipos_sorted = sorted(tipos_pqrs.items(), key=lambda x: x[1], reverse=True)
            tipos = [t[0] for t in tipos_sorted]
            cantidades = [t[1] for t in tipos_sorted]
            
            # Capitalizar y formatear tipos
            tipos_capitalizados = [t.replace('_', ' ').title() for t in tipos]
            
            # Paleta de colores profesional (azul a verde)
            colores = ['#3498db', '#5dade2', '#48c9b0', '#52be80', '#58d68d', '#7dcea0']
            colores_chart = (colores * (len(tipos) // len(colores) + 1))[:len(tipos)]
            
            bars = ax2.barh(tipos_capitalizados, cantidades, color=colores_chart, 
                          edgecolor='white', linewidth=1.5, height=0.7)
            
            # Sombra sutil en las barras
            for bar in bars:
                bar.set_alpha(0.85)
            
            ax2.set_xlabel('Cantidad de Solicitudes', fontsize=12, fontweight='bold', color='#2c3e50')
            ax2.set_title('Distribución por Tipo de Solicitud', fontsize=14, fontweight='bold', pad=20, color='#2c3e50')
            ax2.grid(axis='x', alpha=0.2, linestyle='--', linewidth=0.8)
            ax2.set_axisbelow(True)  # Grid detrás de las barras
            
            # Añadir valores y porcentajes en las barras
            total_tipos = sum(cantidades)
            for i, (bar, cant) in enumerate(zip(bars, cantidades)):
                width = bar.get_width()
                porcentaje = (cant / total_tipos * 100) if total_tipos > 0 else 0
                ax2.text(width + max(cantidades)*0.02, bar.get_y() + bar.get_height()/2, 
                        f'{int(width)} ({porcentaje:.1f}%)', 
                        ha='left', va='center', fontsize=10, fontweight='bold', color='#34495e')
        
        buffer2 = BytesIO()
        plt.savefig(buffer2, format='png', dpi=150, bbox_inches='tight')
        buffer2.seek(0)
        charts['tipos'] = buffer2
        plt.close(fig2)
        
        # Gráfico 3: Tendencia Mensual (Line Chart mejorado)
        fig3, ax3 = plt.subplots(figsize=(10, 6), facecolor='white')
        
        # Agrupar PQRS por mes con conteo real
        meses_dict = {}
        for pqrs in self.pqrs_list:
            try:
                fecha_str = str(pqrs.get('fecha_solicitud', ''))
                if fecha_str:
                    fecha = datetime.fromisoformat(fecha_str.replace('Z', '+00:00'))
                    mes_key = fecha.strftime('%Y-%m')
                    meses_dict[mes_key] = meses_dict.get(mes_key, 0) + 1
            except:
                continue
        
        if meses_dict and len(meses_dict) > 0:
            meses_ordenados = sorted(meses_dict.keys())
            valores_meses = [meses_dict[m] for m in meses_ordenados]
            
            # Formatear etiquetas de meses en español
            meses_es = {
                'Jan': 'Ene', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Abr',
                'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Aug': 'Ago',
                'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dic'
            }
            meses_labels = []
            for m in meses_ordenados:
                fecha_temp = datetime.strptime(m, '%Y-%m')
                label_en = fecha_temp.strftime('%b %Y')
                mes_abr = label_en.split()[0]
                label_es = meses_es.get(mes_abr, mes_abr) + ' ' + label_en.split()[1]
                meses_labels.append(label_es)
            
            # Gráfica de línea elegante con gradiente
            ax3.plot(meses_labels, valores_meses, marker='o', linewidth=3, 
                    color='#e74c3c', markersize=10, markerfacecolor='#e74c3c', 
                    markeredgecolor='white', markeredgewidth=2.5, label='PQRS Recibidas',
                    zorder=3)  # Línea al frente
            
            # Área sombreada con gradiente suave
            ax3.fill_between(range(len(meses_labels)), valores_meses, alpha=0.25, 
                           color='#e74c3c', zorder=2)
            
            ax3.set_xlabel('Período', fontsize=12, fontweight='bold', color='#2c3e50')
            ax3.set_ylabel('Cantidad de PQRS', fontsize=12, fontweight='bold', color='#2c3e50')
            ax3.set_title('Evolución Temporal de PQRS', fontsize=14, fontweight='bold', pad=20, color='#2c3e50')
            ax3.grid(True, alpha=0.2, linestyle='--', linewidth=0.8, zorder=1)
            ax3.legend(loc='upper left', fontsize=11, framealpha=0.9, edgecolor='gray')
            ax3.set_axisbelow(True)
            
            # Añadir valores sobre cada punto con fondo
            for i, (x, y) in enumerate(zip(range(len(meses_labels)), valores_meses)):
                ax3.text(x, y + max(valores_meses)*0.03, str(y), 
                        ha='center', va='bottom', fontsize=10, fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='gray', alpha=0.8))
            
            plt.xticks(rotation=45, ha='right', fontsize=10)
        else:
            # Sin datos temporales
            ax3.text(0.5, 0.5, 'Sin datos temporales disponibles', 
                    ha='center', va='center', transform=ax3.transAxes, 
                    fontsize=12, color='gray')
        
        buffer3 = BytesIO()
        plt.savefig(buffer3, format='png', dpi=150, bbox_inches='tight')
        buffer3.seek(0)
        charts['tendencias'] = buffer3
        plt.close(fig3)
        
        # Gráfico 4: Tiempos de Respuesta (Nuevo)
        fig4, ax4 = plt.subplots(figsize=(10, 6), facecolor='white')
        
        # Calcular distribución de tiempos
        tiempos = []
        for pqrs in self.pqrs_list:
            if pqrs.get('dias_respuesta') and pqrs['dias_respuesta'] > 0:
                tiempos.append(pqrs['dias_respuesta'])
        
        if tiempos:
            # Crear rangos de tiempo
            rangos = ['0-5 días', '6-10 días', '11-15 días', '16-20 días', '>20 días']
            conteos = [
                len([t for t in tiempos if 0 <= t <= 5]),
                len([t for t in tiempos if 6 <= t <= 10]),
                len([t for t in tiempos if 11 <= t <= 15]),
                len([t for t in tiempos if 16 <= t <= 20]),
                len([t for t in tiempos if t > 20])
            ]
            
            # Colores semafóricos profesionales
            colores_tiempos = ['#27ae60', '#2ecc71', '#f39c12', '#e67e22', '#c0392b']
            bars = ax4.bar(rangos, conteos, color=colores_tiempos, edgecolor='white', 
                          linewidth=2, width=0.7, alpha=0.85)
            
            ax4.set_ylabel('Cantidad de PQRS', fontsize=12, fontweight='bold', color='#2c3e50')
            ax4.set_title('Distribución de Tiempos de Respuesta', fontsize=14, fontweight='bold', 
                         pad=20, color='#2c3e50')
            ax4.grid(axis='y', alpha=0.2, linestyle='--', linewidth=0.8)
            ax4.set_axisbelow(True)
            
            # Línea de referencia legal elegante
            if max(conteos) > 0:
                ax4.axhline(y=max(conteos)*0.5, color='#e74c3c', linestyle='--', 
                           linewidth=2.5, alpha=0.6, label='Referencia legal: 15 días')
            
            # Añadir valores sobre barras con fondo
            for bar, conteo in zip(bars, conteos):
                if conteo > 0:
                    height = bar.get_height()
                    ax4.text(bar.get_x() + bar.get_width()/2., height + max(conteos)*0.02,
                            f'{int(conteo)}',
                            ha='center', va='bottom', fontsize=11, fontweight='bold',
                            bbox=dict(boxstyle='round,pad=0.3', facecolor='white', 
                                    edgecolor='gray', alpha=0.9))
            
            ax4.legend(loc='upper right', fontsize=10, framealpha=0.9, edgecolor='gray')
            plt.xticks(rotation=20, ha='right', fontsize=10)
            
            # Añadir promedio con estilo profesional
            promedio = sum(tiempos) / len(tiempos)
            ax4.text(0.02, 0.98, f'⏱ Promedio: {promedio:.1f} días', 
                    transform=ax4.transAxes, fontsize=12, fontweight='bold',
                    verticalalignment='top', color='#2c3e50',
                    bbox=dict(boxstyle='round,pad=0.5', facecolor='#ecf0f1', 
                            edgecolor='#34495e', alpha=0.9, linewidth=2))
        else:
            ax4.text(0.5, 0.5, 'Datos de tiempos no disponibles', 
                    ha='center', va='center', transform=ax4.transAxes, 
                    fontsize=12, color='gray')
        
        buffer4 = BytesIO()
        plt.savefig(buffer4, format='png', dpi=150, bbox_inches='tight')
        buffer4.seek(0)
        charts['tiempos'] = buffer4
        plt.close(fig4)
        
        # Gráfico 5: Comparativa Estado vs Tipo (Heatmap)
        fig5, ax5 = plt.subplots(figsize=(11, 7), facecolor='white')
        
        # Crear matriz de estado vs tipo
        if tipos_pqrs and self.pqrs_list:
            estados_lista = ['recibida', 'asignada', 'en_proceso', 'respondida', 'cerrada']
            tipos_lista = list(tipos_pqrs.keys())
            
            # Matriz de conteo
            matriz = np.zeros((len(estados_lista), len(tipos_lista)))
            
            for pqrs in self.pqrs_list:
                estado = pqrs.get('estado', '').lower()
                tipo = pqrs.get('tipo_solicitud', '').lower()
                
                if estado in estados_lista and tipo in tipos_lista:
                    i = estados_lista.index(estado)
                    j = tipos_lista.index(tipo)
                    matriz[i, j] += 1
            
            # Crear heatmap con paleta profesional
            im = ax5.imshow(matriz, cmap='RdYlGn_r', aspect='auto', alpha=0.85)
            
            # Etiquetas con mejor formato
            estados_labels = [e.replace('_', ' ').title() for e in estados_lista]
            tipos_labels = [t.replace('_', ' ').title() for t in tipos_lista]
            
            ax5.set_xticks(np.arange(len(tipos_labels)))
            ax5.set_yticks(np.arange(len(estados_labels)))
            ax5.set_xticklabels(tipos_labels, rotation=45, ha='right', fontsize=10)
            ax5.set_yticklabels(estados_labels)
            
            # Añadir valores en cada celda
            for i in range(len(estados_lista)):
                for j in range(len(tipos_lista)):
                    text = ax5.text(j, i, int(matriz[i, j]),
                                   ha='center', va='center', color='black', 
                                   fontsize=10, fontweight='bold')
            
            ax5.set_title('Matriz: Estado vs Tipo de Solicitud', fontsize=13, fontweight='bold', pad=15)
            plt.colorbar(im, ax=ax5, label='Cantidad')
        
        buffer5 = BytesIO()
        plt.savefig(buffer5, format='png', dpi=150, bbox_inches='tight')
        buffer5.seek(0)
        charts['matriz'] = buffer5
        plt.close(fig5)
        
        print(f"✅ {len(charts)} gráficas generadas exitosamente")
        return charts
    
    @staticmethod
    def _detect_template_margins(template_pdf_bytes: bytes):
        """
        Analiza el template PDF y detecta automáticamente el espacio
        que ocupan el encabezado (arriba) y el pie de página (abajo),
        sin importar la posición exacta en cada entidad.
        Retorna (top_margin_inches, bottom_margin_inches).
        """
        import fitz
        doc = fitz.open(stream=template_pdf_bytes, filetype="pdf")
        page = doc[0]
        page_height = page.rect.height   # puntos PDF
        mid_y = page_height / 2
        PADDING_PT = 14  # margen extra de seguridad en puntos

        header_bottom = 0.0   # borde inferior del encabezado
        footer_top    = page_height  # borde superior del pie

        # Bloques de texto
        for block in page.get_text("blocks"):
            x0, y0, x1, y1 = block[:4]
            if y1 < mid_y:
                header_bottom = max(header_bottom, y1)
            elif y0 > mid_y:
                footer_top = min(footer_top, y0)

        # Trazados vectoriales (líneas, rectángulos, etc.)
        for draw in page.get_drawings():
            r = draw.get("rect")
            if r:
                if r.y1 < mid_y:
                    header_bottom = max(header_bottom, r.y1)
                elif r.y0 > mid_y:
                    footer_top = min(footer_top, r.y0)

        # Imágenes incrustadas (p.ej. logo)
        for img in page.get_image_info(xrefs=True):
            bbox = img.get("bbox")
            if bbox:
                y0, y1 = bbox[1], bbox[3]
                if y1 < mid_y:
                    header_bottom = max(header_bottom, y1)
                elif y0 > mid_y:
                    footer_top = min(footer_top, y0)

        doc.close()

        top_in    = (header_bottom + PADDING_PT) / 72.0
        bottom_in = (page_height - footer_top + PADDING_PT) / 72.0

        # Límites razonables
        top_in    = round(max(0.75, min(3.5, top_in)), 3)
        bottom_in = round(max(0.5,  min(2.5, bottom_in)), 3)

        print(f"📐 Márgenes detectados → top: {top_in}in  bottom: {bottom_in}in")
        return top_in, bottom_in

    @staticmethod
    def _find_page_number_word_indices(words: list) -> tuple[int, int, int, int] | None:
        """Ubica índices de [Página, num_actual, de, num_total] en la lista de palabras."""
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

    @staticmethod
    def _word_rect(word) -> fitz.Rect:
        return fitz.Rect(word[0], word[1], word[2], word[3])

    @staticmethod
    def _redact_tight(page, rect: fitz.Rect) -> None:
        pad = 0.5
        tight = fitz.Rect(
            rect.x0 - pad,
            rect.y0 - pad,
            rect.x1 + pad,
            rect.y1 + pad,
        )
        page.add_redact_annot(tight)
        page.apply_redactions()

    @staticmethod
    def _insert_at_word(page, word, text: str) -> None:
        rect = PQRSReportGenerator._word_rect(word)
        fontsize = max(7, min(14, rect.height * 0.9))
        page.insert_text(
            (rect.x0, rect.y1 - 1),
            str(text),
            fontsize=fontsize,
            color=(0, 0, 0),
            fontname="helv",
        )

    @staticmethod
    def _replace_page_number(page, page_index: int, total_pages: int) -> None:
        """
        Actualiza solo los dígitos de 'Página X de Y' en el membrete.
        No toca el resto del template ni pinta cajas blancas grandes.
        """
        words = page.get_text("words")
        indices = PQRSReportGenerator._find_page_number_word_indices(words)
        if indices:
            _, num_a_idx, _, num_b_idx = indices
            num_word_a = words[num_a_idx]
            num_word_b = words[num_b_idx]
            PQRSReportGenerator._redact_tight(page, PQRSReportGenerator._word_rect(num_word_a))
            PQRSReportGenerator._redact_tight(page, PQRSReportGenerator._word_rect(num_word_b))
            PQRSReportGenerator._insert_at_word(page, num_word_a, page_index + 1)
            PQRSReportGenerator._insert_at_word(page, num_word_b, total_pages)
            return

        page_num_re = re.compile(r"P[aá]gina\s+\d+\s+de\s+\d+", re.IGNORECASE)
        for block in page.get_text("blocks"):
            if len(block) < 5:
                continue
            text = str(block[4]).strip()
            if not page_num_re.search(text):
                continue
            rect = fitz.Rect(block[:4])
            PQRSReportGenerator._redact_tight(page, rect)
            fontsize = max(7, min(14, rect.height * 0.9))
            page.insert_text(
                (rect.x0, rect.y1 - 1),
                f"Página {page_index + 1} de {total_pages}",
                fontsize=fontsize,
                color=(0, 0, 0),
                fontname="helv",
            )
            return

    def _create_content_pdf(self, top_margin: float = 1.6, bottom_margin: float = 1.0) -> BytesIO:
        """
        Crea el PDF con el contenido del informe (sin template, solo contenido).
        El template se aplica en generate_pdf() como post-proceso via PyMuPDF.
        """
        buffer = BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            topMargin=top_margin*inch,
            bottomMargin=bottom_margin*inch,
            leftMargin=0.75*inch,
            rightMargin=0.75*inch
        )
        
        # Estilos
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.black,
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.black,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        
        subheading_style = ParagraphStyle(
            'CustomSubheading',
            parent=self.styles['Heading3'],
            fontSize=12,
            textColor=colors.black,
            spaceAfter=8,
            fontName='Helvetica-Bold'
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_JUSTIFY,
            spaceAfter=8
        )
        
        table_header_style = ParagraphStyle(
            'TableHeaderStyle',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            alignment=TA_CENTER
        )
        
        # ***** PORTADA PERSONALIZADA *****
        # Calcular trimestre y mes de generación
        trimestre_info = self._calcular_trimestre()
        _meses_es_portada = {
            1:"Enero",2:"Febrero",3:"Marzo",4:"Abril",5:"Mayo",6:"Junio",
            7:"Julio",8:"Agosto",9:"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"
        }
        _hoy = datetime.now()
        mes_generacion = f"{_meses_es_portada[_hoy.month]} {_hoy.year}"
        
        # Espaciado inicial
        self.story.append(Spacer(1, 0.5*inch))
        
        # Encabezado verde oscuro con título principal
        header_data = [[Paragraph("<b>Informe de Seguimiento</b><br/>Proceso de Peticiones, Quejas, Reclamos, Solicitudes,<br/>Denuncias y Felicitaciones (PQRSDF)", 
                                 ParagraphStyle('HeaderText', 
                                              parent=normal_style, 
                                              alignment=TA_CENTER,
                                              fontSize=14,
                                              textColor=colors.white,
                                              fontName='Helvetica-Bold',
                                              leading=18))]]
        
        header_table = Table(header_data, colWidths=[6.5*inch])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#2d5016')),  # Verde oscuro
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
            ('LEFTPADDING', (0, 0), (-1, -1), 20),
            ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ]))
        self.story.append(header_table)
        self.story.append(Spacer(1, 0.1*inch))
        
        # Nombre de la entidad en caja verde claro
        entity_data = [[Paragraph(f"<b>{self.entity.name.upper()}</b>", 
                                 ParagraphStyle('EntityText', 
                                              parent=normal_style, 
                                              alignment=TA_CENTER,
                                              fontSize=16,
                                              textColor=colors.black,
                                              fontName='Helvetica-Bold'))]]
        
        entity_table = Table(entity_data, colWidths=[6.5*inch])
        entity_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#c3d69b')),  # Verde claro
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ]))
        self.story.append(entity_table)
        self.story.append(Spacer(1, 0.5*inch))
        
        # Periodo trimestral en caja verde claro
        periodo_text = f"<b>{trimestre_info['texto_periodo']}<br/>{trimestre_info['año']}</b>"
        periodo_data = [[Paragraph(periodo_text, 
                                  ParagraphStyle('PeriodoText', 
                                               parent=normal_style, 
                                               alignment=TA_RIGHT,
                                               fontSize=14,
                                               textColor=colors.black,
                                               fontName='Helvetica-Bold',
                                               leading=20))]]
        
        periodo_table = Table(periodo_data, colWidths=[6.5*inch])
        periodo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#c3d69b')),  # Verde claro
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('RIGHTPADDING', (0, 0), (-1, -1), 30),
        ]))
        self.story.append(periodo_table)
        self.story.append(Spacer(1, 0.5*inch))
        
        # Mes de generación (alineado a la derecha)
        mes_style = ParagraphStyle(
            'MesStyle',
            parent=normal_style,
            fontSize=14,
            alignment=TA_RIGHT,
            fontName='Helvetica'
        )
        self.story.append(Paragraph(mes_generacion, mes_style))
        self.story.append(PageBreak())

        # ---- Datos dinámicos de la entidad ----
        entity_name      = self.entity.name        # Ej: "Alcaldía Municipal de Sora"
        entity_email     = self.entity.email or "contactenos@entidad.gov.co"
        entity_slug      = self.entity.slug or ""
        entity_website   = f"https://www.{entity_slug}.gov.co" if entity_slug else "el sitio web institucional"
        pqrs_url         = f"{entity_website}/peticiones-quejas-reclamos"
        from django.conf import settings as dj_settings
        app_base = (getattr(dj_settings, "APP_BASE_URL", "") or "").strip().rstrip("/")
        if not app_base:
            app_base = "https://app.softone360.com"
        portal_pqrs_url = f"{app_base}/portal/{entity_slug}" if entity_slug else app_base

        # Número de trimestre en palabras
        _trimestre_palabras = {1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto"}
        _tri_num = trimestre_info['trimestre']
        trimestre_palabra = _trimestre_palabras.get(_tri_num, "")
        año_informe = trimestre_info['año']

        # Fechas del periodo formateadas en español
        from datetime import datetime as _dt
        _meses_es = {
            1:"enero",2:"febrero",3:"marzo",4:"abril",5:"mayo",6:"junio",
            7:"julio",8:"agosto",9:"septiembre",10:"octubre",11:"noviembre",12:"diciembre"
        }
        _fi = _dt.strptime(self.fecha_inicio, '%Y-%m-%d')
        _ff = _dt.strptime(self.fecha_fin,    '%Y-%m-%d')
        fecha_inicio_larga = f"{_fi.day:02d} de {_meses_es[_fi.month]} de {_fi.year}"
        fecha_fin_larga    = f"{_ff.day:02d} de {_meses_es[_ff.month]} de {_ff.year}"
        periodo_texto = f"{_fi.day:02d} de {_meses_es[_fi.month]} y {_ff.day:02d} de {_meses_es[_ff.month]} de {_ff.year}"

        section_style = ParagraphStyle(
            'SectionHeading',
            parent=heading_style,
            fontSize=11,
            textColor=colors.black,
            fontName='Helvetica-Bold',
            spaceAfter=6,
            spaceBefore=14
        )

        # ***** INTRODUCCIÓN *****
        self.story.append(Paragraph("INTRODUCCIÓN", section_style))
        intro1 = (
            "En cumplimiento al Artículo 76 de la Ley 1474 de 2011, <i>\"En toda entidad pública, "
            "deberá existir por lo menos una dependencia encargada de recibir, tramitar y resolver "
            "las quejas, sugerencias y reclamos que los ciudadanos formulen, y que se relacionen con "
            "el cumplimiento de la misión de la entidad. La Oficina de Control Interno deberá vigilar "
            "que la atención se preste de acuerdo con las normas legales vigentes y rendirá a la "
            "administración de la entidad un informe semestral sobre el particular\"</i> así mismo la "
            "Ley 1755 de 2015 <i>\"Por medio de la cual se regula el Derecho Fundamental de Petición\"</i>. "
            "Decreto 1166 de Julio 19 de 2016 <i>\"Por el cual se adiciona el capítulo 12 al Título 3 "
            "de la Parte 2 del Libro 2 del Decreto 1069 de 2015, Decreto Único Reglamentario del Sector "
            "Justicia y del Derecho, relacionado con la presentación, tratamiento y radicación de las "
            "peticiones presentadas verbalmente\"</i>. Resolución N° 001519 de 24 de agosto de 2020 "
            "<i>\"Por la cual se definen los estándares y directrices para publicar la información "
            "señalada en la Ley 1712 del 2014 y se definen los requisitos materia de acceso a la "
            "información pública, accesibilidad web, seguridad digital, y datos abiertos\"</i>. "
            "Circular 100-010-2021 Directrices para fortalecer la implementación de lenguaje claro."
        )
        self.story.append(Paragraph(intro1, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        intro2 = (
            f"El {entity_name} realiza el seguimiento a las Peticiones, Quejas, Reclamos, Solicitudes "
            f"y Denuncias (PQRSD) presentadas por los ciudadanos o grupo de ciudadanos con el fin de "
            f"verificar su oportunidad, materialidad, congruencia y veracidad para lo cual se apoya en "
            f"los registros del sistema de información del sitio web institucional, el cual lleva el "
            f"registro desde su radicación hasta la salida de su respuesta, adicionalmente permite "
            f"generar reportes permanentes sobre el estado de las PQRSD, buscando determinar las "
            f"posibles debilidades y fortalezas para ser llevadas a la alta dirección en busca del "
            f"mejoramiento continuo de la Entidad y con ella, afianzar la confianza del ciudadano en "
            f"las instituciones públicas."
        )
        self.story.append(Paragraph(intro2, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        intro3 = (
            f"Así mismo el {entity_name} en desarrollo del Plan Anual de Auditoría {año_informe} y "
            f"dando cumplimiento a lo estipulado en el Artículo 17 del Decreto 648 de 2017, respecto "
            f"al desarrollo de sus roles de evaluación y seguimiento, liderazgo estratégico y enfoque "
            f"hacia la prevención; efectuó seguimiento a la gestión del {trimestre_palabra} trimestre "
            f"de {año_informe} relacionada con la atención de las PQRS tramitadas por cada una de las "
            f"dependencias que conforman el {entity_name}."
        )
        self.story.append(Paragraph(intro3, normal_style))
        self.story.append(Spacer(1, 0.15*inch))

        # ***** OBJETIVO *****
        self.story.append(Paragraph("OBJETIVO.", section_style))
        objetivo = (
            f"Garantizar la efectividad del ejercicio de los derechos reconocidos en la Constitución "
            f"y facilitar la participación de los ciudadanos en las decisiones que los afectan mediante "
            f"la promoción específica de la participación ciudadana, optimizando el procedimiento de "
            f"atención a las PQRSD."
        )
        self.story.append(Paragraph(objetivo, normal_style))
        self.story.append(Spacer(1, 0.15*inch))

        # ***** ALCANCE *****
        self.story.append(Paragraph("ALCANCE.", section_style))
        alcance = (
            f"El seguimiento se realiza a las PQRSD radicadas durante el periodo comprendido entre "
            f"el {periodo_texto}, con base en la información suministrada por el sistema de PQRS "
            f"del sitio web institucional del {entity_name}."
        )
        self.story.append(Paragraph(alcance, normal_style))
        self.story.append(Spacer(1, 0.15*inch))

        # ***** METODOLOGÍA *****
        self.story.append(Paragraph("METODOLOGÍA.", section_style))
        meto_intro = (
            f"El {entity_name} con los canales de atención busca que los cuales los ciudadanos y "
            f"grupos de interés pueden formular peticiones, quejas, reclamos, sugerencias y denuncias "
            f"sobre temas competencia de la entidad."
        )
        self.story.append(Paragraph(meto_intro, normal_style))
        self.story.append(Spacer(1, 0.08*inch))

        canales = [
            (
                "Canal Virtual",
                f"El {entity_name} ha dispuesto de un link en su página web "
                f"<u>{pqrs_url}</u> para la radicación, así como el portal público de PQRS "
                f"en <u>{portal_pqrs_url}</u>, a través del cual se pueden formular las "
                f"PQRSD, al igual que el ciudadano las puede radicar a través del correo "
                f"electrónico institucional <u>{entity_email}</u>."
            ),
            (
                "Canal Escrito",
                "Conformado por los mecanismos de recepción de documentos escritos a través de "
                "correo postal o radicación personal o mediante el buzón."
            ),
            (
                "Canal Presencial",
                "Se puede acceder en el contacto directo con el personal de Atención al Ciudadano "
                "a través de la Ventanilla Única en el segundo nivel de servicio, con el fin de "
                "brindar información personalizada frente a peticiones, quejas, reclamos, sugerencias "
                "y denuncias o recibir la misma de manera verbal adelantando el trámite de radicación, "
                "en el evento de ser necesario."
            ),
            (
                "Canal Telefónico",
                f"La Administración municipal ha dispuesto diferentes líneas telefónicas para atender "
                f"las solicitudes y/o quejas que requieran presentar."
            ),
        ]

        canal_label_style = ParagraphStyle(
            'CanalLabel',
            parent=normal_style,
            fontName='Helvetica-Bold',
            fontSize=10
        )
        for titulo, descripcion in canales:
            self.story.append(Paragraph(f"{titulo}:", canal_label_style))
            self.story.append(Paragraph(descripcion, normal_style))
            self.story.append(Spacer(1, 0.05*inch))

        self.story.append(Spacer(1, 0.1*inch))
        self.story.append(Paragraph(
            "A continuación, se relacionan los canales de atención con su especificación del "
            "servicio a prestar:", normal_style
        ))
        self.story.append(Spacer(1, 0.1*inch))

        # ***** CANALES DE SERVICIO *****
        self.story.append(Paragraph("1. CANALES DE SERVICIO", section_style))
        canales_intro = (
            f"Los canales de atención que ofrece el {entity_name} son: Presencial, virtual y telefónico:"
        )
        self.story.append(Paragraph(canales_intro, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        self.story.append(Paragraph("2.1. Atención presencial:", canal_label_style))
        self.story.append(Spacer(1, 0.05*inch))

        presencial_texto = (
            f"Se presta atención personal en cada una de las secretarías dependiendo la necesidad "
            f"del ciudadano en nuestras oficinas ubicadas en {entity_name} en:"
        )
        self.story.append(Paragraph(presencial_texto, normal_style))

        if self.entity.address:
            self.story.append(Paragraph(f"Dirección: {self.entity.address}", normal_style))
        if self.entity.horario_atencion:
            self.story.append(Paragraph(f"Horario de atención: {self.entity.horario_atencion}", normal_style))

        radicacion_texto = (
            f"Para radicación de PQRSDF: Las pueden realizar a través de la ventanilla única ubicada "
            f"en {self.entity.address or 'las instalaciones de la entidad'} en el horario de atención "
            f"mencionado anteriormente. Con el número de radicado, usted podrá realizar el seguimiento "
            f"a su petición, queja, reclamo, sugerencia o denuncia."
        )
        self.story.append(Paragraph(radicacion_texto, normal_style))
        self.story.append(Paragraph(
            "Buzón de sugerencias: Adicionalmente, las peticiones, quejas, reclamos, sugerencias y "
            "denuncias, podrán presentarse utilizando el buzón de sugerencias ubicado en las "
            "instalaciones de la Entidad.", normal_style
        ))
        self.story.append(Spacer(1, 0.08*inch))

        self.story.append(Paragraph("Telefónico: A través de las líneas celulares:", canal_label_style))
        self.story.append(Spacer(1, 0.1*inch))

        # Tabla teléfonos
        phone_val = self.entity.phone or "—"
        phone_data = [
            ["SECRETARIA/OFICINA", "LÍNEAS CELULARES"],
            ["Despacho", phone_val],
        ]
        phone_table = Table(phone_data, colWidths=[3.5*inch, 3.0*inch])
        phone_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d5016')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        self.story.append(phone_table)
        self.story.append(Spacer(1, 0.2*inch))

        # ***** INFORME DE GESTIÓN INSTITUCIONAL *****
        self.story.append(Paragraph("INFORME DE GESTIÓN INSTITUCIONAL", section_style))
        gestion_intro = (
            "Con el fin de dar cumplimiento a las respuestas de las distintas PQRSD, la entidad "
            "establece como puntos de control acorde a la Ley 1755 de 2015 Artículo 14. Términos "
            "para resolver las distintas modalidades de peticiones los siguientes:"
        )
        self.story.append(Paragraph(gestion_intro, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        terminos_data = [
            ["CLASE TERMINO", "CLASE TERMINO"],
            ["Petición en interés general y particular",
             "Dentro de los quince (15) días siguientes a su recepción"],
            ["Peticiones de Documentos e Información",
             "Dentro los diez (10) días siguientes a su recepción"],
            ["Consultas",
             "Dentro de los treinta (30) días siguientes a su recepción"],
            ["Peticiones entre autoridades",
             "Dentro de los cinco (5) días siguientes a su recepción"],
            ["Informes a concejales",
             "Dentro de los cinco (5) días siguientes a su recepción"],
        ]
        terminos_table = Table(terminos_data, colWidths=[3.25*inch, 3.25*inch])
        terminos_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d5016')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        self.story.append(terminos_table)
        self.story.append(Spacer(1, 0.2*inch))
        
        # ***** INDICADORES GENERALES *****
        self.story.append(Paragraph("INDICADORES GENERALES", heading_style))
        
        indicadores_data = [
            ["Indicador", "Valor"],
            ['Total de PQRS', str(self.analytics.get('totalPqrs', 0))],
            ['PQRS Pendientes', str(self.analytics.get('pendientes', 0))],
        ]
        # Solo mostrar filas con valor > 0 para estados intermedios
        if self.analytics.get('enProceso', 0) > 0:
            indicadores_data.append(['PQRS En Proceso', str(self.analytics.get('enProceso', 0))])
        indicadores_data.append(['PQRS Resueltas', str(self.analytics.get('resueltas', 0))])
        if self.analytics.get('cerradas', 0) > 0:
            indicadores_data.append(['PQRS Cerradas', str(self.analytics.get('cerradas', 0))])
        indicadores_data.append(['Tasa de Resolución', f"{self.analytics.get('tasaResolucion', 0)}%"])
        tiempo = self.analytics.get('tiempoPromedioRespuesta', 0)
        indicadores_data.append(['Tiempo Promedio de Respuesta', f"{tiempo} días" if tiempo > 0 else 'No registrado'])
        
        indicadores_table = Table(indicadores_data, colWidths=[4*inch, 2*inch])
        indicadores_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d5016')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
        ]))
        
        self.story.append(indicadores_table)
        self.story.append(Spacer(1, 0.1*inch))
        
        # ***** ANÁLISIS DE LA INFORMACIÓN *****
        self.story.append(Paragraph("ANÁLISIS DE LA INFORMACIÓN", heading_style))
        self.story.append(Spacer(1, 0.08*inch))
        
        # Generar gráficas (ahora incluye 5 gráficos)
        charts = self.generate_charts()
        
        # Subsección: Introducción (IA)
        if 'introduccion' in self.ai_analysis and self.ai_analysis['introduccion']:
            self.story.append(Paragraph("Introducción", subheading_style))
            self._render_text_block(self.ai_analysis['introduccion'], normal_style)
            self.story.append(Spacer(1, 0.1*inch))
        
        # Subsección: Análisis General (IA)
        self.story.append(Paragraph("Análisis General", subheading_style))
        self._render_text_block(self.ai_analysis['analisisGeneral'], normal_style)
        self.story.append(Spacer(1, 0.1*inch))
        
        # Gráfica 1: Distribución por Estado
        if 'estados' in charts:
            self.story.append(KeepTogether([
                Paragraph("Distribución de PQRS por Estado", subheading_style),
                RLImage(charts['estados'], width=4.5*inch, height=2.8*inch),
                Spacer(1, 0.1*inch)
            ]))
        
        # Gráfica 2: Distribución por Tipo
        if 'tipos' in charts:
            self.story.append(KeepTogether([
                Paragraph("Distribución de PQRS por Tipo de Solicitud", subheading_style),
                RLImage(charts['tipos'], width=5*inch, height=2.6*inch),
                Spacer(1, 0.1*inch)
            ]))
        
        # Subsección: Análisis de Tiempos de Respuesta (IA + Gráfica)
        if 'analisisTiempos' in self.ai_analysis and self.ai_analysis['analisisTiempos']:
            tiempos_block = [
                Paragraph("Análisis de Tiempos de Respuesta", subheading_style),
            ]
            # Añadir texto como párrafos individuales al bloque
            for line in str(self.ai_analysis['analisisTiempos']).split('\n'):
                line = line.strip()
                if line:
                    tiempos_block.append(Paragraph(line, normal_style))
            if 'tiempos' in charts:
                tiempos_block.append(Spacer(1, 0.06*inch))
                tiempos_block.append(RLImage(charts['tiempos'], width=4.5*inch, height=2.2*inch))
            tiempos_block.append(Spacer(1, 0.08*inch))
            self.story.append(KeepTogether(tiempos_block))
        
        # Gráfica 5: Matriz Estado vs Tipo
        if 'matriz' in charts:
            self.story.append(KeepTogether([
                Paragraph("Análisis Cruzado: Estado vs Tipo", subheading_style),
                Paragraph(
                    "Esta matriz permite identificar patrones en la gestión de diferentes tipos de solicitudes "
                    "según su estado actual, facilitando la detección de cuellos de botella o áreas de mejora.",
                    normal_style
                ),
                Spacer(1, 0.06*inch),
                RLImage(charts['matriz'], width=4.8*inch, height=2.4*inch),
                Spacer(1, 0.08*inch)
            ]))
        
        # Subsección: RECOMENDACIONES (IA)
        self.story.append(Paragraph("RECOMENDACIONES", heading_style))
        self.story.append(Spacer(1, 0.08*inch))
        
        # Renderizar recomendaciones (lista o texto)
        recs = self.ai_analysis.get('recomendaciones', [])
        print(f"🔍 DEBUG recomendaciones type={type(recs).__name__} len={len(recs) if isinstance(recs, (list,str)) else '?'} preview={str(recs)[:300]}", flush=True)
        # Saltar la primera recomendación (index 0)
        if isinstance(recs, list) and len(recs) > 1:
            for rec in recs[1:]:
                rec = rec.strip()
                if rec:
                    self.story.append(Paragraph(rec, normal_style))
                    self.story.append(Spacer(1, 0.15*inch))
        elif isinstance(recs, list) and recs:
            self._render_text_block(recs, normal_style)
        elif isinstance(recs, str) and recs:
            self._render_text_block(recs, normal_style)
        
        self.story.append(Spacer(1, 0.1*inch))
        
        # ***** DETALLE DE PQRS *****
        self.story.append(Paragraph("DETALLE DE PQRS RECIENTES", heading_style))
        
        pqrs_recientes = self.pqrs_list[:20]  # Primeras 20
        pqrs_data = [['Radicado', 'Tipo', 'Estado', 'Fecha']]
        
        for pqrs in pqrs_recientes:
            fecha = datetime.fromisoformat(str(pqrs.get('fecha_solicitud', '')).replace('Z', '+00:00'))
            pqrs_data.append([
                pqrs.get('numero_radicado', 'N/A'),
                pqrs.get('tipo_solicitud', 'N/A').replace('_', ' ').title(),
                pqrs.get('estado', 'N/A').replace('_', ' ').title(),
                fecha.strftime('%Y-%m-%d')
            ])
        
        pqrs_table = Table(pqrs_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        pqrs_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d5016')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        
        self.story.append(pqrs_table)
        self.story.append(Spacer(1, 0.15*inch))
        
        # ***** CONCLUSIONES *****
        self.story.append(Paragraph("CONCLUSIONES", heading_style))
        self._render_text_block(self.ai_analysis['conclusiones'], normal_style)
        self.story.append(Spacer(1, 0.1*inch))
        
        # Marco legal y consideraciones finales
        marco_legal = (
            "Es pertinente considerar todos los requerimientos como derecho de petición teniendo en cuenta la "
            "<b>Ley 1755 de 2015</b> \"Por medio de la cual se regula el Derecho Fundamental de Petición\". "
            "<b>Decreto 1166 de Julio 19 de 2016</b> \"Por el cual se adiciona el capítulo 12 al Título 3 de la Parte 2 "
            "del Libro 2 del Decreto 1069 de 2015, Decreto Único Reglamentario del Sector Justicia y del Derecho, "
            "relacionado con la presentación, tratamiento y radicación de las peticiones presentadas verbalmente\". "
            "<b>Resolución N° 001519 de 24 de agosto de 2020</b> \"Por la cual se definen los estándares y directrices "
            "para publicar la información señalada en la Ley 1712 del 2014\"; se debe tener en cuenta como un mecanismo "
            "de respuesta oportuna a la comunidad, ante tantas necesidades presentadas para solución de parte de la "
            "Administración Pública, en donde se deben evidenciar las acciones eficientes y efectivas que se reflejen "
            "en el valor público generado por los funcionarios y contratistas de la Administración; por tanto es "
            "responsabilidad de la Institución Pública verificar dichos indicadores generando una mejora continua; "
            "es menester de la Alta dirección mediante el Comité Institucional de Gestión y Desempeño autoevaluar la "
            "política, especialmente analizar las respuestas inoportunas, planteando plan de mejora interno por parte "
            "de la Secretaría General quien lidera esta política así como la calidad de respuesta."
        )
        self.story.append(Paragraph(marco_legal, normal_style))
        self.story.append(Spacer(1, 0.2*inch))
        
        # ***** SECCIÓN DE FIRMA *****
        self.story.append(Spacer(1, 0.3*inch))
        
        # Estilo para la sección de firma
        firma_style = ParagraphStyle(
            'FirmaStyle',
            parent=normal_style,
            fontSize=11,
            alignment=TA_CENTER,
            spaceAfter=8,
            textColor=colors.HexColor('#2c3e50')
        )
        
        nombre_firma_style = ParagraphStyle(
            'NombreFirmaStyle',
            parent=normal_style,
            fontSize=12,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
            spaceAfter=4,
            textColor=colors.HexColor('#2c3e50')
        )
        
        cargo_firma_style = ParagraphStyle(
            'CargoFirmaStyle',
            parent=normal_style,
            fontSize=10,
            alignment=TA_CENTER,
            spaceAfter=15,
            textColor=colors.HexColor('#34495e')
        )
        
        # Línea de firma elegante
        firma_table_data = [
            [''],  # Espacio para la firma
            ['_' * 60],  # Línea de firma
        ]
        
        firma_table = Table(firma_table_data, colWidths=[6*inch])
        firma_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('FONTNAME', (0, 1), (0, 1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (0, 1), 10),
            ('TEXTCOLOR', (0, 1), (0, 1), colors.HexColor('#7f8c8d')),
            ('TOPPADDING', (0, 0), (0, 0), 30),  # Espacio para firma manuscrita
        ]))
        
        self.story.append(firma_table)
        self.story.append(Spacer(1, 0.15*inch))
        
        # Nombre y cargo del firmante
        if self.usuario_firmante:
            # Usar datos del usuario seleccionado
            self.story.append(Paragraph(
                f"<b>{self.usuario_firmante.full_name.upper()}</b>",
                nombre_firma_style
            ))
            
            # Usar secretaría o rol como cargo
            cargo = ""
            if getattr(self.usuario_firmante, "secretaria", None):
                cargo = self.usuario_firmante.secretaria.nombre
            elif getattr(self.usuario_firmante, "role", None):
                cargo = str(self.usuario_firmante.role).replace("_", " ").title()
            self.story.append(Paragraph(cargo or "Administrador", cargo_firma_style))
        else:
            # Si no hay usuario seleccionado, mostrar líneas para llenar manualmente
            self.story.append(Paragraph(
                "<b>_______________________________________</b>",
                nombre_firma_style
            ))
            self.story.append(Paragraph("Nombre del Firmante", cargo_firma_style))
        
        self.story.append(Spacer(1, 0.2*inch))
        self.story.append(Paragraph(
            f"<i>{self.entity.name}</i>",
            firma_style
        ))
        
        # Construir PDF
        doc.build(self.story)
        buffer.seek(0)
        return buffer

    def generate_pdf(self) -> BytesIO:
        """
        Genera el PDF final.
        Si hay template: descarga desde S3 via boto3, detecta márgenes
        automáticamente, genera el contenido con esos márgenes y aplica
        el template vectorial como fondo en cada página.
        """
        import fitz  # PyMuPDF
        import traceback

        from django.conf import settings

        from apps.common.b2_client import get_b2_client

        template_pdf_bytes = None
        top_margin    = 1.6
        bottom_margin = 1.0

        if self.entity.pdf_template_url:
            try:
                key = self.entity.pdf_template_url.lstrip("/")
                client = get_b2_client()
                s3_resp = client.get_object(Bucket=settings.B2_BUCKET_PQRS, Key=key)
                template_pdf_bytes = s3_resp["Body"].read()
                top_margin, bottom_margin = self._detect_template_margins(template_pdf_bytes)
            except Exception as e:
                print(f"⚠️ Error descargando template: {e}")
                traceback.print_exc()
                template_pdf_bytes = None

        # Generar contenido con los márgenes correctos para este template
        content_buffer = self._create_content_pdf(
            top_margin=top_margin,
            bottom_margin=bottom_margin
        )

        if not template_pdf_bytes:
            return content_buffer

        try:
            content_buffer.seek(0)
            content_doc = fitz.open(stream=content_buffer.read(), filetype="pdf")
            total_pages = len(content_doc)

            for i, page in enumerate(content_doc):
                tpl_doc = fitz.open(stream=template_pdf_bytes, filetype="pdf")
                tpl_page = tpl_doc[0]
                self._replace_page_number(tpl_page, i, total_pages)
                page.show_pdf_page(page.rect, tpl_doc, 0, overlay=False)
                tpl_doc.close()

            final_buffer = BytesIO()
            content_doc.save(final_buffer)
            content_doc.close()
            final_buffer.seek(0)

            print(f"✅ PDF con membrete institucional generado ({total_pages} páginas)")
            return final_buffer

        except Exception as e:
            print(f"⚠️ Error aplicando template: {e}")
            traceback.print_exc()
            content_buffer.seek(0)
            return content_buffer
    
    def save_to_file(self, filename: str):
        """Guarda el PDF en un archivo"""
        pdf_buffer = self.generate_pdf()
        with open(filename, 'wb') as f:
            f.write(pdf_buffer.read())
        print(f"✅ PDF guardado: {filename}")
