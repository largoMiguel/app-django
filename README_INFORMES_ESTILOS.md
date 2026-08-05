# Guía de estilos para informes PDF institucionales

Esta guía define la paleta de colores, estructura de portada, tablas y gráficas para los informes PDF generados en los módulos **Planes Institucionales**, **PDM** y **PQRS**.

> **Alcance:** aplica a PDM, Planes Institucionales y PQRS con la misma paleta gris institucional.

## Paleta de colores

| Color | Hex | Uso |
|-------|-----|-----|
| Gris oscuro | `#2D3748` | Texto principal, números, encabezados de tabla, barras de gráficas |
| Gris medio | `#CBD5E1` | Líneas divisorias horizontales de tablas (0.5 pt), ejes y grid de gráficas |
| Gris súper claro | `#F8FAFC` | Fondo de filas alternas (efecto cebra, filas pares) |
| Blanco | `#FFFFFF` | Fondo general de página, filas impares, texto sobre encabezados |

### Contraste en gráficas matplotlib

| Uso | Hex |
|-----|-----|
| Barras principales | `#2D3748` |
| Barras secundarias (valores bajos) | `#94A3B8` |
| Texto y títulos | `#2D3748` |
| Spines y grid | `#CBD5E1` |
| Fondo de figura | `#FFFFFF` |

## Estructura de tablas

### Encabezados
- Fondo: `#2D3748`
- Texto: `#FFFFFF`, negrita (`Helvetica-Bold`)
- Alineación: igual que la columna de datos (texto a la izquierda, números a la derecha)

### Filas de datos
- Filas impares: `#FFFFFF`
- Filas pares: `#F8FAFC` (efecto cebra vía `ROWBACKGROUNDS`)

### Bordes
- Solo líneas **horizontales** de 0.5 pt en `#CBD5E1` (`LINEBELOW`)
- **No** usar `GRID`, `BOX`, `INNERGRID` ni líneas verticales

### Alineación
- Textos descriptivos: izquierda
- Números, porcentajes e ítems: derecha
- Encabezados alineados con el tipo de dato de su columna

### Ejemplo con el helper compartido

```python
from reportlab.platypus import Table, TableStyle
from apps.common.report_theme import table_style_cmds

rows = [
    [Paragraph("<b>Producto</b>", header_style), Paragraph("<b>Avance</b>", header_style)],
    [Paragraph("Indicador X", cell_left), Paragraph("75%", cell_right)],
    [Paragraph("Indicador Y", cell_left), Paragraph("42%", cell_right)],
]

table = Table(rows, colWidths=[4 * inch, 1.5 * inch])
table.setStyle(TableStyle(
    table_style_cmds(
        n_rows=len(rows),
        numeric_cols=(1,),      # columna de avance alineada a la derecha
        left_cols=(0,),         # columna de texto alineada a la izquierda
    )
))
```

## Estructura de portada

La portada sigue la estructura del informe PQRS, recoloreada a escala de grises:

1. **Banner superior** (6.5"): título + subtítulo, fondo `#2D3748`, texto blanco, centrado
2. **Caja entidad**: nombre en mayúsculas, fondo `#F8FAFC`, texto `#2D3748`
3. **Caja periodo**: vigencia/trimestre, fondo `#F8FAFC`, alineada a la derecha
4. **Mes de generación**: alineado a la derecha, `#2D3748`

### Reutilizar en nuevos informes

```python
from apps.common.report_cover import build_cover_flowables

cover = build_cover_flowables(
    title_line="Informe de Seguimiento",
    subtitle_line="Subtítulo del informe",
    entity_name=entity.name,
    period_text="Trimestre I — 2026",
    normal_style=normal_style,
    top_spacer=0.5,           # 1.4 si hay membrete institucional
    extra_flowables=[],       # bloques adicionales antes del PageBreak
)
story.extend(cover)
```

## Banners de sección

Los títulos de sección dentro del documento usan fondo `#2D3748` con texto blanco:

```python
from apps.common.report_theme import banner_style_cmds

table.setStyle(TableStyle(banner_style_cmds()))
```

## Módulos de referencia

| Archivo | Descripción |
|---------|-------------|
| `backend/apps/common/report_theme.py` | Constantes de color y `table_style_cmds()` |
| `backend/apps/common/report_cover.py` | `build_cover_flowables()` para portada estándar |
| `backend/apps/planes/informes/report_generator.py` | Generador Planes Institucionales |
| `backend/apps/pdm/informes/report_generator.py` | Generador PDM |
| `backend/apps/pqrs/services/report_generator.py` | Generador PQRS |

## Reglas generales

- Usar **únicamente** los cuatro colores de la paleta (más `#94A3B8` solo para contraste en gráficas)
- Mantener fondo de página blanco
- Evitar colores saturados (verde, azul, rojo, naranja) en informes institucionales
- Las gráficas matplotlib deben usar escala de grises, sin semáforo de colores
- El membrete institucional (plantilla PDF de entidad) se superpone por detrás; el contenido respeta los márgenes detectados automáticamente
