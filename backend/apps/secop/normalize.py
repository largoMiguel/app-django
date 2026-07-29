"""Normalización de filas SECOP I/II a un shape canónico."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from .datasets import extract_notice_uid


def _parse_date(raw: Any) -> date | None:
    if not raw:
        return None
    text = str(raw).strip()
    if not text or text.lower() in {"no definido", "no definida"}:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text[: len(fmt.replace("%f", "000"))], fmt.replace(".%f", "")).date()
        except ValueError:
            continue
    if "T" in text:
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        except ValueError:
            pass
    return None


def _parse_float(raw: Any) -> float:
    if raw is None:
        return 0.0
    text = str(raw).strip().replace(",", "")
    if not text or text.lower() in {"no definido", "no definida", "no aplica"}:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _url_from_field(raw: Any) -> str | None:
    if isinstance(raw, dict):
        return raw.get("url") or None
    if raw:
        return str(raw)
    return None


def normalize_secop1(row: dict[str, Any]) -> dict[str, Any]:
    uid = str(row.get("uid") or "").strip()
    valor = _parse_float(row.get("cuantia_contrato") or row.get("cuantia_proceso"))
    adiciones = _parse_float(row.get("valor_total_de_adiciones"))
    fecha_firma = _parse_date(row.get("fecha_de_firma_del_contrato"))
    fecha_inicio = _parse_date(row.get("fecha_ini_ejec_contrato"))
    fecha_fin = _parse_date(row.get("fecha_fin_ejec_contrato"))
    return {
        "fuente": "secop1",
        "tipo_registro": "contrato",
        "id": uid,
        "referencia": row.get("numero_de_contrato") or row.get("numero_de_proceso") or uid,
        "proceso_id": row.get("numero_de_proceso"),
        "portfolio_id": None,
        "notice_uid": None,
        "entidad": row.get("nombre_entidad"),
        "objeto": row.get("objeto_del_contrato_a_la") or row.get("detalle_del_objeto_a_contratar"),
        "proveedor": row.get("nom_razon_social_contratista"),
        "documento_proveedor": row.get("identificacion_del_contratista"),
        "valor": valor,
        "valor_pagado": valor,
        "valor_pendiente": 0.0,
        "valor_adiciones": adiciones,
        "valor_con_adiciones": _parse_float(row.get("valor_contrato_con_adiciones")) or (valor + adiciones),
        "estado": row.get("estado_del_proceso") or "Desconocido",
        "modalidad": row.get("modalidad_de_contratacion") or row.get("nombre_regimen_de_contratacion"),
        "tipo": row.get("tipo_de_contrato"),
        "fecha_firma": fecha_firma.isoformat() if fecha_firma else None,
        "fecha_inicio": fecha_inicio.isoformat() if fecha_inicio else None,
        "fecha_fin": fecha_fin.isoformat() if fecha_fin else None,
        "supervisor": None,
        "ordenador_gasto": None,
        "origen_recursos": row.get("destino_gasto"),
        "departamento": row.get("departamento_entidad"),
        "ciudad": row.get("municipio_entidad"),
        "liquidacion": None,
        "adjudicado": True,
        "url": _url_from_field(row.get("ruta_proceso_en_secop_i")),
        "raw": row,
    }


def normalize_secop2_contract(row: dict[str, Any]) -> dict[str, Any]:
    cid = str(row.get("id_contrato") or "").strip()
    portfolio = str(row.get("proceso_de_compra") or "").strip() or None
    notice = extract_notice_uid(row.get("urlproceso"))
    valor = _parse_float(row.get("valor_del_contrato"))
    pagado = _parse_float(row.get("valor_pagado"))
    pendiente = _parse_float(row.get("valor_pendiente_de_pago"))
    fecha_firma = _parse_date(row.get("fecha_de_firma"))
    fecha_inicio = _parse_date(row.get("fecha_de_inicio_del_contrato"))
    fecha_fin = _parse_date(row.get("fecha_de_fin_del_contrato"))
    recursos = []
    for label, key in (
        ("PGN", "presupuesto_general_de_la_nacion_pgn"),
        ("SGP", "sistema_general_de_participaciones"),
        ("Regalías", "sistema_general_de_regal_as"),
        ("Propios", "recursos_propios"),
        ("Crédito", "recursos_de_credito"),
    ):
        v = _parse_float(row.get(key))
        if v > 0:
            recursos.append({"fuente": label, "valor": v})
    return {
        "fuente": "secop2",
        "tipo_registro": "contrato",
        "id": cid,
        "referencia": row.get("referencia_del_contrato") or cid,
        "proceso_id": row.get("proceso_de_compra"),
        "portfolio_id": portfolio,
        "notice_uid": notice,
        "entidad": row.get("nombre_entidad"),
        "objeto": row.get("objeto_del_contrato") or row.get("descripcion_del_proceso"),
        "proveedor": row.get("proveedor_adjudicado"),
        "documento_proveedor": row.get("documento_proveedor"),
        "valor": valor,
        "valor_pagado": pagado,
        "valor_pendiente": pendiente,
        "valor_adiciones": 0.0,
        "valor_con_adiciones": valor,
        "estado": row.get("estado_contrato") or "Desconocido",
        "modalidad": row.get("modalidad_de_contratacion"),
        "tipo": row.get("tipo_de_contrato"),
        "fecha_firma": fecha_firma.isoformat() if fecha_firma else None,
        "fecha_inicio": fecha_inicio.isoformat() if fecha_inicio else None,
        "fecha_fin": fecha_fin.isoformat() if fecha_fin else None,
        "supervisor": row.get("nombre_supervisor"),
        "ordenador_gasto": row.get("nombre_ordenador_del_gasto"),
        "origen_recursos": row.get("origen_de_los_recursos"),
        "recursos_desglose": recursos,
        "departamento": row.get("departamento"),
        "ciudad": row.get("ciudad"),
        "liquidacion": row.get("liquidaci_n") or row.get("liquidacion"),
        "es_pyme": row.get("es_pyme"),
        "adjudicado": True,
        "url": _url_from_field(row.get("urlproceso")),
        "raw": row,
    }


def normalize_secop2_process(row: dict[str, Any]) -> dict[str, Any]:
    pid = str(row.get("id_del_proceso") or "").strip()
    portfolio = str(row.get("id_del_portafolio") or "").strip() or None
    notice = extract_notice_uid(row.get("urlproceso"))
    valor = _parse_float(row.get("precio_base") or row.get("valor_total_adjudicacion"))
    fecha_pub = _parse_date(row.get("fecha_de_publicacion_del"))
    adjudicado = str(row.get("adjudicado") or "").strip().lower() == "si"
    return {
        "fuente": "secop2",
        "tipo_registro": "proceso",
        "id": pid,
        "referencia": row.get("referencia_del_proceso") or pid,
        "proceso_id": pid,
        "portfolio_id": portfolio,
        "notice_uid": notice,
        "entidad": row.get("entidad"),
        "objeto": row.get("descripci_n_del_procedimiento") or row.get("nombre_del_procedimiento"),
        "proveedor": row.get("nombre_del_proveedor") if adjudicado else None,
        "documento_proveedor": row.get("nit_del_proveedor_adjudicado"),
        "valor": valor,
        "valor_pagado": 0.0,
        "valor_pendiente": valor,
        "valor_adiciones": 0.0,
        "valor_con_adiciones": valor,
        "estado": row.get("estado_resumen") or row.get("estado_del_procedimiento") or "Desconocido",
        "modalidad": row.get("modalidad_de_contratacion"),
        "tipo": row.get("tipo_de_contrato"),
        "fecha_firma": fecha_pub.isoformat() if fecha_pub else None,
        "fecha_inicio": None,
        "fecha_fin": None,
        "supervisor": None,
        "ordenador_gasto": row.get("nombre_del_adjudicador"),
        "origen_recursos": None,
        "recursos_desglose": [],
        "departamento": row.get("departamento_entidad"),
        "ciudad": row.get("ciudad_entidad"),
        "liquidacion": None,
        "fase": row.get("fase"),
        "proveedores_manifestaron": _parse_float(row.get("proveedores_que_manifestaron")),
        "adjudicado": adjudicado,
        "url": _url_from_field(row.get("urlproceso")),
        "raw": row,
    }


def public_record(rec: dict[str, Any]) -> dict[str, Any]:
    """Versión sin raw para respuestas API."""
    out = {k: v for k, v in rec.items() if k != "raw"}
    return out
