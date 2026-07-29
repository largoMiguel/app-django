"""Unificación de procesos y contratos SECOP II."""
from __future__ import annotations

from typing import Any

from .datasets import (
    fetch_secop2_contracts,
    fetch_secop2_processes,
    fetch_secop2_processes_by_portfolios,
    extract_notice_uid,
)
from .normalize import normalize_secop2_contract, normalize_secop2_process, public_record


def _index_processes(processes: list[dict[str, Any]]) -> tuple[dict[str, dict], dict[str, dict]]:
    by_portfolio: dict[str, dict] = {}
    by_notice: dict[str, dict] = {}
    for row in processes:
        norm = normalize_secop2_process(row)
        if norm["portfolio_id"]:
            by_portfolio[norm["portfolio_id"]] = norm
        if norm["notice_uid"]:
            by_notice[norm["notice_uid"]] = norm
    return by_portfolio, by_notice


def load_secop2_unified(
    nits: list[str],
    anio: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    contracts_raw, err_c = fetch_secop2_contracts(nits, anio)
    processes_raw, err_p = fetch_secop2_processes(nits, anio)

    by_portfolio, by_notice = _index_processes(processes_raw)

    # Procesos vinculados a contratos del año pero publicados en otro año
    missing_portfolios = []
    for row in contracts_raw:
        portfolio = str(row.get("proceso_de_compra") or "").strip()
        if portfolio and portfolio not in by_portfolio:
            missing_portfolios.append(portfolio)
    if missing_portfolios:
        extra_raw, _ = fetch_secop2_processes_by_portfolios(nits, missing_portfolios)
        extra_by_portfolio, extra_by_notice = _index_processes(extra_raw)
        by_portfolio.update(extra_by_portfolio)
        by_notice.update(extra_by_notice)

    unified: list[dict[str, Any]] = []
    linked_process_ids: set[str] = set()

    for row in contracts_raw:
        norm = normalize_secop2_contract(row)
        portfolio = norm.get("portfolio_id")
        notice = norm.get("notice_uid") or extract_notice_uid(row.get("urlproceso"))
        proc = None
        if portfolio and portfolio in by_portfolio:
            proc = by_portfolio[portfolio]
        elif notice and notice in by_notice:
            proc = by_notice[notice]
        if proc:
            norm["proceso_vinculado"] = public_record(proc)
            linked_process_ids.add(proc["id"])
        unified.append(norm)

    for row in processes_raw:
        norm = normalize_secop2_process(row)
        if norm["id"] in linked_process_ids:
            continue
        unified.append(norm)

    meta = {
        "anio": anio,
        "total_contratos": len(contracts_raw),
        "total_procesos": len(processes_raw),
        "total_unificado": len(unified),
        "errors": [e for e in (err_c, err_p) if e],
    }
    return unified, meta


def load_secop1_normalized(nits: list[str], anio: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    from .datasets import fetch_secop1_contracts
    from .normalize import normalize_secop1

    rows, err = fetch_secop1_contracts(nits, anio)
    records = [normalize_secop1(r) for r in rows]
    meta = {
        "anio": anio,
        "total": len(records),
        "errors": [err] if err else [],
    }
    return records, meta
