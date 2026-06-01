"""Parser de archivos Excel/CSV de ejecución presupuestal PDM."""
from __future__ import annotations

import io
import re
import unicodedata
from decimal import Decimal
from typing import Any

import pandas as pd

REQUIRED_NORM = [
    "ULT NIVEL",
    "SECTOR",
    "PRODUCTO",
    "DESCRIPCION FTE",
    "PTO INICIAL",
    "ADICION",
    "REDUCCION",
    "CREDITO",
    "CONTRACREDITO",
    "PTO DEFINITIVO",
    "PAGOS",
]

ALIASES = {
    "ULTIMO NIVEL": "ULT NIVEL",
    "ULT. NIVEL": "ULT NIVEL",
    "ULT  NIVEL": "ULT NIVEL",
    "DESCRIPCION FTE": "DESCRIPCION FTE",
    "DESCRIPCION FTE ": "DESCRIPCION FTE",
    "DESCRIPCION FUENTE": "DESCRIPCION FTE",
    "DESCRIPCION DE LA FUENTE": "DESCRIPCION FTE",
    "DESCRIPCION DE FUENTE": "DESCRIPCION FTE",
    "DESCRIPCION FUENTE DE FINANCIACION": "DESCRIPCION FTE",
    "NOMBRE FUENTE": "NOMBRE FUENTE",
    "NOMBRE DE LA FUENTE": "NOMBRE FUENTE",
    "CODIGO FUENTE": "CODIGO FUENTE",
    "COD FUENTE": "CODIGO FUENTE",
    "COD FTE": "CODIGO FUENTE",
    "PRODUCTO INDICADOR": "PRODUCTO",
    "NOMBRE PRODUCTO": "PRODUCTO",
    "CODIGO Y NOMBRE PRODUCTO": "PRODUCTO",
    "PTO. INICIAL": "PTO INICIAL",
    "PRESUPUESTO INICIAL": "PTO INICIAL",
    "PTO INICIAL $": "PTO INICIAL",
    "ADICIONES": "ADICION",
    "REDUCCIONES": "REDUCCION",
    "PTO. DEFINITIVO": "PTO DEFINITIVO",
    "PRESUPUESTO DEFINITIVO": "PTO DEFINITIVO",
    "PTO DEFINITIVO $": "PTO DEFINITIVO",
    "VALOR PAGADO": "PAGOS",
    "PAGOS EFECTUADOS": "PAGOS",
    "PAGOS ACUMULADOS": "PAGOS",
}


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"", "nan", "none", "nat"}:
        return ""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace(".", " ").replace(",", " ").replace("$", " ")
    text = re.sub(r"\s+", " ", text)
    return text.upper()


def _canonical(name: str) -> str:
    norm = _normalize_text(name)
    return ALIASES.get(norm, norm)


def _build_column_mapping(columns: list[str]) -> tuple[dict[str, str], list[str]]:
    mapping: dict[str, str] = {}
    normalized_cols: list[str] = []
    for col in columns:
        norm = _normalize_text(col)
        mapping[norm] = col
        normalized_cols.append(norm)
    return mapping, normalized_cols


def _looks_like_codigo_fuente(text: str) -> bool:
    value = (text or "").strip()
    if not value:
        return False
    return bool(re.match(r"^[\d.]+$", value))


def _has_descripcion_fte_header(normalized_cols: list[str]) -> bool:
    for norm in normalized_cols:
        if not norm:
            continue
        if "DESCRIPCION" in norm and ("FTE" in norm or "FUENTE" in norm):
            return True
        if norm in {"DESCRIPCION FTE", "DESCRIPCION FUENTE", "DESCRIPCION DE LA FUENTE"}:
            return True
    return False


def _coalesce_descripcion_values(series: pd.Series) -> str:
    values = [str(v).strip() for v in series if pd.notna(v) and str(v).strip()]
    for value in values:
        if not _looks_like_codigo_fuente(value) and len(value) > 2:
            return value
    return values[0] if values else ""


def _build_renamed(df: pd.DataFrame) -> pd.DataFrame:
    mapping, normalized_cols = _build_column_mapping(list(df.columns))
    has_desc_header = _has_descripcion_fte_header(normalized_cols)
    rename_to_canonical: dict[str, str] = {}
    for norm_col in normalized_cols:
        if not norm_col:
            continue
        orig = mapping[norm_col]
        if norm_col == "FUENTE":
            rename_to_canonical[orig] = "CODIGO FUENTE" if has_desc_header else "DESCRIPCION FTE"
        else:
            rename_to_canonical[orig] = ALIASES.get(norm_col, norm_col)

    renamed = df.rename(columns=rename_to_canonical)

    desc_cols = [col for col in renamed.columns if col == "DESCRIPCION FTE"]
    if len(desc_cols) > 1:
        renamed["DESCRIPCION FTE"] = renamed[desc_cols].apply(_coalesce_descripcion_values, axis=1)
        renamed = renamed.drop(columns=[col for col in desc_cols if col != "DESCRIPCION FTE"])

    if "NOMBRE FUENTE" in renamed.columns:
        nombre = renamed["NOMBRE FUENTE"].astype(str).str.strip()
        if "DESCRIPCION FTE" in renamed.columns:
            desc = renamed["DESCRIPCION FTE"].astype(str).str.strip()
            renamed["DESCRIPCION FTE"] = [
                n if n and n.lower() != "nan" else (d if not _looks_like_codigo_fuente(d) else n or d)
                for n, d in zip(nombre, desc, strict=False)
            ]
        else:
            renamed["DESCRIPCION FTE"] = nombre

    return renamed.loc[:, ~renamed.columns.duplicated()]


def _read_raw(contents: bytes, filename: str) -> pd.DataFrame:
    if filename.lower().endswith(".csv"):
        return pd.read_csv(io.BytesIO(contents), header=None, sep=None, engine="python", encoding="utf-8-sig")
    try:
        return pd.read_excel(io.BytesIO(contents), header=None)
    except Exception:
        return pd.read_excel(io.BytesIO(contents), header=None, engine="xlrd")


def _forward_fill_row(row_values: list[Any]) -> list[str]:
    filled: list[str] = []
    last = ""
    for value in row_values:
        norm = _normalize_text(value)
        if norm:
            last = norm
        filled.append(last)
    return filled


def _combine_header_rows(row_a: list[str], row_b: list[str]) -> list[str]:
    max_len = max(len(row_a), len(row_b))
    combined: list[str] = []
    for idx in range(max_len):
        left = row_a[idx] if idx < len(row_a) else ""
        right = row_b[idx] if idx < len(row_b) else ""
        if left and right and left != right:
            merged = _normalize_text(f"{left} {right}")
            combined.append(ALIASES.get(merged, merged))
        else:
            combined.append(left or right)
    return combined


def _row_has_required(row_norm: list[str]) -> bool:
    row_set = {ALIASES.get(x, x) for x in row_norm if x}
    return set(REQUIRED_NORM).issubset(row_set)


def _labels_from_header(row_values: list[Any], row_norm: list[str]) -> list[str]:
    labels: list[str] = []
    for idx, value in enumerate(row_values):
        raw = str(value).strip()
        if raw and raw.lower() not in {"nan", "none", "nat"}:
            labels.append(raw)
            continue
        canonical = ALIASES.get(row_norm[idx], row_norm[idx]) if idx < len(row_norm) else ""
        labels.append(canonical or f"COLUMNA_{idx}")
    return labels


def _detect_header_row(contents: bytes, filename: str) -> pd.DataFrame | None:
    df_raw = _read_raw(contents, filename)
    max_scan = min(40, len(df_raw))

    for i in range(max_scan):
        row_values = list(df_raw.iloc[i].tolist())
        row_norm = _forward_fill_row(row_values)
        if _row_has_required(row_norm):
            cols = _labels_from_header(row_values, row_norm)
            df = df_raw.iloc[i + 1 :].copy()
            df.columns = cols
            return df

        if i + 1 < max_scan:
            next_values = list(df_raw.iloc[i + 1].tolist())
            next_norm = _forward_fill_row(next_values)
            combined = _combine_header_rows(row_norm, next_norm)
            if _row_has_required(combined):
                cols = _labels_from_header(next_values, combined)
                df = df_raw.iloc[i + 2 :].copy()
                df.columns = cols
                return df

    return None


def _try_read_dataframe(contents: bytes, filename: str) -> tuple[pd.DataFrame | None, list[str]]:
    readers = []
    if filename.lower().endswith(".csv"):
        readers = [
            lambda: pd.read_csv(io.BytesIO(contents), header=0, sep=None, engine="python", encoding="utf-8-sig"),
            lambda: pd.read_csv(io.BytesIO(contents), header=1, sep=None, engine="python", encoding="utf-8-sig"),
        ]
    else:
        readers = [
            lambda: pd.read_excel(io.BytesIO(contents), header=0),
            lambda: pd.read_excel(io.BytesIO(contents), header=1),
        ]

    errors: list[str] = []
    for read in readers:
        try:
            return read(), []
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))
    return None, errors


def _missing_columns(df_renamed: pd.DataFrame) -> list[str]:
    present_norm = {_canonical(str(col)) for col in df_renamed.columns}
    return [col for col in REQUIRED_NORM if col not in present_norm]


def limpiar_numero(valor) -> Decimal:
    if pd.isna(valor) or valor == "":
        return Decimal("0.00")
    valor_str = str(valor).strip().replace('"', "").replace(",", "")
    try:
        return Decimal(valor_str)
    except Exception:
        return Decimal("0.00")


def extraer_codigo_producto(producto_str: str) -> str:
    if not producto_str or pd.isna(producto_str):
        return ""
    match = re.search(r"(\d{4,10})\s*-", str(producto_str))
    if match:
        return match.group(1)
    match = re.search(r"(\d{4,10})", str(producto_str))
    return match.group(1) if match else ""


def clave_fuente_exacta(fuente: str | None) -> str:
    if fuente is None:
        return "Sin Fuente"
    texto = str(fuente).strip()
    return texto if texto else "Sin Fuente"


def resolver_descripcion_fte(row: pd.Series) -> str:
    desc = clave_fuente_exacta(str(row.get("DESCRIPCION FTE", "")))
    if desc != "Sin Fuente" and not _looks_like_codigo_fuente(desc):
        return desc

    for col in row.index:
        norm = _normalize_text(str(col))
        if "NOMBRE" in norm and "FUENTE" in norm:
            nombre = clave_fuente_exacta(str(row.get(col, "")))
            if nombre != "Sin Fuente":
                return nombre

    if "CODIGO FUENTE" in row.index:
        codigo = clave_fuente_exacta(str(row.get("CODIGO FUENTE", "")))
        if desc != "Sin Fuente" and _looks_like_codigo_fuente(desc) and codigo != "Sin Fuente":
            # Mantener descripción textual si existe en otra columna no mapeada
            for col in row.index:
                norm = _normalize_text(str(col))
                if norm in {"FUENTE", "CODIGO FUENTE", "COD FUENTE", "DESCRIPCION FTE"}:
                    continue
                if "FUENTE" in norm or "FTE" in norm:
                    candidato = clave_fuente_exacta(str(row.get(col, "")))
                    if candidato != "Sin Fuente" and not _looks_like_codigo_fuente(candidato):
                        return candidato

    if desc != "Sin Fuente":
        return desc

    if "CODIGO FUENTE" in row.index:
        codigo = clave_fuente_exacta(str(row.get("CODIGO FUENTE", "")))
        if codigo != "Sin Fuente":
            return codigo

    return "Sin Fuente"


def calcular_pto_definitivo_componentes(
    pto_inicial: float,
    adicion: float,
    reduccion: float,
    credito: float,
    contracredito: float,
) -> float:
    return (
        float(pto_inicial or 0)
        + float(adicion or 0)
        - float(reduccion or 0)
        + float(credito or 0)
        - float(contracredito or 0)
    )


def parse_ejecucion_excel(contents: bytes, filename: str) -> tuple[pd.DataFrame, list[str]]:
    df_detected = _detect_header_row(contents, filename)
    if df_detected is not None:
        df_renamed = _build_renamed(df_detected)
    else:
        df, read_errors = _try_read_dataframe(contents, filename)
        if df is None:
            raise ValueError(f"No se pudo leer el archivo: {' | '.join(read_errors or [])}")
        df_renamed = _build_renamed(df)

    faltantes = _missing_columns(df_renamed)
    if faltantes:
        disponibles = ", ".join(str(c) for c in df_renamed.columns)
        raise ValueError(f"Columnas faltantes en el archivo: {', '.join(faltantes)}. Disponibles: {disponibles}")

    df_filtrado = df_renamed[
        (df_renamed["ULT NIVEL"].astype(str).str.strip().str.upper().isin(["SI", "SÍ"]))
        & (df_renamed["SECTOR"].notna())
        & (df_renamed["SECTOR"].astype(str).str.strip() != "")
    ].copy()

    return df_filtrado, []


def rows_from_ejecucion_dataframe(df_filtrado: pd.DataFrame, anio: int) -> tuple[list[dict[str, Any]], list[str]]:
    has_dependencia = any(_normalize_text(c) == "DEPENDENCIA" for c in df_filtrado.columns)
    has_bpin = any(_normalize_text(c) == "BPIN" for c in df_filtrado.columns)
    registros_unicos: dict[tuple[str, str], dict[str, Any]] = {}
    errores: list[str] = []

    for idx, row in df_filtrado.iterrows():
        try:
            codigo_producto = extraer_codigo_producto(row["PRODUCTO"])
            if not codigo_producto:
                errores.append(f"Fila {idx + 2}: No se pudo extraer código de producto de '{row['PRODUCTO']}'")
                continue

            descripcion_fte = resolver_descripcion_fte(row)
            clave = (codigo_producto, descripcion_fte)

            if clave in registros_unicos:
                registros_unicos[clave]["pto_inicial"] += limpiar_numero(row["PTO INICIAL"])
                registros_unicos[clave]["adicion"] += limpiar_numero(row["ADICION"])
                registros_unicos[clave]["reduccion"] += limpiar_numero(row["REDUCCION"])
                registros_unicos[clave]["credito"] += limpiar_numero(row["CREDITO"])
                registros_unicos[clave]["contracredito"] += limpiar_numero(row["CONTRACREDITO"])
                registros_unicos[clave]["pagos"] += limpiar_numero(row["PAGOS"])
            else:
                registros_unicos[clave] = {
                    "codigo_producto": codigo_producto,
                    "descripcion_fte": descripcion_fte,
                    "pto_inicial": limpiar_numero(row["PTO INICIAL"]),
                    "adicion": limpiar_numero(row["ADICION"]),
                    "reduccion": limpiar_numero(row["REDUCCION"]),
                    "credito": limpiar_numero(row["CREDITO"]),
                    "contracredito": limpiar_numero(row["CONTRACREDITO"]),
                    "pagos": limpiar_numero(row["PAGOS"]),
                    "sector": str(row["SECTOR"]).strip() if pd.notna(row["SECTOR"]) else None,
                    "dependencia": str(row["DEPENDENCIA"]).strip()
                    if has_dependencia and pd.notna(row.get("DEPENDENCIA"))
                    else None,
                    "bpin": str(row["BPIN"]).strip() if has_bpin and pd.notna(row.get("BPIN")) else None,
                    "anio": anio,
                }
        except Exception as exc:  # noqa: BLE001
            errores.append(f"Fila {idx + 2}: {exc}")

    rows: list[dict[str, Any]] = []
    for datos in registros_unicos.values():
        pto_def = calcular_pto_definitivo_componentes(
            float(datos["pto_inicial"]),
            float(datos["adicion"]),
            float(datos["reduccion"]),
            float(datos["credito"]),
            float(datos["contracredito"]),
        )
        datos["pto_definitivo"] = Decimal(str(pto_def))
        rows.append(datos)

    return rows, errores
