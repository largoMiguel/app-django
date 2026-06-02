"""Parser de archivos Excel/CSV de contratos RPS."""
from __future__ import annotations

import io
import re
import unicodedata
from typing import Any

import pandas as pd
from rest_framework.exceptions import ValidationError

CRP_COLUMN_CANDIDATES = (
    "NO CRP",
    "NO CRP/CRP",
    "NO. CRP",
    "N° CRP",
    "NRO CRP",
    "NUMERO CRP",
    "NO_CRP",
    "CRP",
)
CDP_COLUMN_CANDIDATES = ("NO CDP", "NO_CDP", "CDP")
HEADER_KEYWORDS = ("CRP", "PRODUCTO", "VALOR", "CONCEPTO", "CDP")


def _normalize_column(name: Any) -> str:
    text = str(name).strip()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text)
    return text.upper()


def _find_column(columns: list[str], candidates: tuple[str, ...]) -> str | None:
    normalized = {_normalize_column(c): c for c in columns}
    for candidate in candidates:
        key = _normalize_column(candidate)
        if key in normalized:
            return normalized[key]
    for col in columns:
        norm = _normalize_column(col)
        for candidate in candidates:
            cand = _normalize_column(candidate)
            if norm == cand or norm.replace(" ", "") == cand.replace(" ", ""):
                return col
    return None


def _detect_header_row(df_raw: pd.DataFrame) -> int:
    for idx in range(len(df_raw)):
        row = df_raw.iloc[idx]
        row_str = " ".join(str(x).upper() for x in row if pd.notna(x))
        if any(keyword in row_str for keyword in HEADER_KEYWORDS):
            return int(idx)
    return 0


def _read_dataframe(content: bytes, filename: str) -> pd.DataFrame:
    if filename.lower().endswith(".csv"):
        return pd.read_csv(io.BytesIO(content), encoding="utf-8")

    df_raw = pd.read_excel(io.BytesIO(content), header=None)
    header_row = _detect_header_row(df_raw)
    df = pd.read_excel(io.BytesIO(content), header=header_row)
    return df


def _clean_producto(value: Any) -> str:
    try:
        num = pd.to_numeric(value, errors="coerce")
        if pd.notna(num):
            return str(int(num))
    except (TypeError, ValueError):
        pass
    text = str(value).strip()
    match = re.search(r"(\d{4,10})\s*-", text)
    if match:
        return match.group(1)
    match = re.search(r"(\d{4,10})", text)
    if match:
        return match.group(1)
    return text.upper()


def parse_contratos_rps(content: bytes, filename: str, anio: int) -> pd.DataFrame:
    """Devuelve DataFrame normalizado: PRODUCTO, NO CRP, VALOR, CONCEPTO, CONTRATISTA, AÑO."""
    df = _read_dataframe(content, filename)
    df.columns = [_normalize_column(c) for c in df.columns]
    if df.columns.duplicated().any():
        df = df.loc[:, ~df.columns.duplicated()].copy()
    df = df.reset_index(drop=True)

    producto_col = _find_column(list(df.columns), ("PRODUCTO", "CODIGO PRODUCTO", "COD PRODUCTO"))
    valor_col = _find_column(list(df.columns), ("VALOR", "VALOR CONTRATO", "VALOR CONTRATADO"))
    crp_col = _find_column(list(df.columns), CRP_COLUMN_CANDIDATES)
    if crp_col is None:
        crp_col = _find_column(list(df.columns), CDP_COLUMN_CANDIDATES)

    missing = []
    if producto_col is None:
        missing.append("PRODUCTO")
    if valor_col is None:
        missing.append("VALOR")
    if crp_col is None:
        missing.append("NO CRP/CRP")
    if missing:
        disponibles = ", ".join(str(c) for c in df.columns)
        raise ValidationError(
            {
                "detail": (
                    f"Columnas requeridas: PRODUCTO, NO CRP/CRP, VALOR. "
                    f"Faltan: {', '.join(missing)}. Columnas detectadas: {disponibles}"
                )
            }
        )

    concepto_col = _find_column(list(df.columns), ("CONCEPTO", "DESCRIPCION", "OBJETO"))
    contratista_col = _find_column(list(df.columns), ("CONTRATISTA", "NOMBRE", "CONTRATISTA NOMBRE"))
    anio_col = _find_column(list(df.columns), ("AÑO", "ANIO", "ANO"))

    df = df.rename(
        columns={
            producto_col: "PRODUCTO",
            valor_col: "VALOR",
            crp_col: "NO CRP",
            **({concepto_col: "CONCEPTO"} if concepto_col else {}),
            **({contratista_col: "CONTRATISTA"} if contratista_col else {}),
            **({anio_col: "AÑO"} if anio_col else {}),
        }
    )
    if "CONCEPTO" not in df.columns:
        df["CONCEPTO"] = ""
    if "CONTRATISTA" not in df.columns:
        df["CONTRATISTA"] = ""

    df = df.dropna(subset=["PRODUCTO", "NO CRP", "VALOR"])
    df["PRODUCTO"] = df["PRODUCTO"].apply(_clean_producto)
    df["NO CRP"] = pd.to_numeric(df["NO CRP"], errors="coerce").fillna(0).astype(int).astype(str)
    df["VALOR"] = pd.to_numeric(df["VALOR"], errors="coerce").fillna(0)
    df["CONCEPTO"] = df["CONCEPTO"].fillna("").astype(str)
    df["CONTRATISTA"] = df["CONTRATISTA"].fillna("").astype(str)

    if "AÑO" in df.columns:
        df["AÑO"] = pd.to_numeric(df["AÑO"], errors="coerce").fillna(anio).astype(int)
    else:
        df["AÑO"] = anio

    df = df[df["AÑO"] == anio].copy()
    if df.empty:
        raise ValidationError({"detail": f"No se encontraron registros para el año {anio}."})

    return df.groupby(["PRODUCTO", "NO CRP", "AÑO"], as_index=False).agg(
        {"VALOR": "sum", "CONCEPTO": "first", "CONTRATISTA": "first"}
    )
