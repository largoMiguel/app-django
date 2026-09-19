"""Unificación de procesos y contratos SECOP II."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from apps.entities.models import Entity

from .access import (
    resolve_codigos_secop_i,
    resolve_codigos_secop_ii,
    resolve_nits_secop_i,
    resolve_nits_secop_ii,
    resolve_nombres_secop_i,
    resolve_nombres_secop_ii,
)
from .datasets import (
    fetch_secop1_contracts,
    fetch_secop2_contracts,
    fetch_secop2_processes,
    fetch_secop2_processes_by_portfolios,
    extract_notice_uid,
)
from .enrich import enrich_secop2
from .normalize import normalize_secop1, normalize_secop2_contract, normalize_secop2_process, public_record


def _base_referencia(referencia: str | None) -> str:
    return (referencia or "").split("(")[0].strip()


def _process_rank(proc: dict[str, Any]) -> tuple[int, int, int]:
    return (
        1 if proc.get("adjudicado") else 0,
        1 if proc.get("proveedor") else 0,
        len(proc.get("referencia") or ""),
    )


def _pick_best_process(processes: list[dict[str, Any]]) -> dict[str, Any]:
    return max(processes, key=_process_rank)


def _index_processes(
    processes: list[dict[str, Any]],
) -> tuple[dict[str, list[dict]], dict[str, dict], dict[str, dict]]:
    by_portfolio: dict[str, list[dict]] = defaultdict(list)
    by_notice: dict[str, dict] = {}
    normalized: list[dict[str, Any]] = []
    for row in processes:
        norm = normalize_secop2_process(row)
        normalized.append(norm)
        if norm["portfolio_id"]:
            by_portfolio[norm["portfolio_id"]].append(norm)
        if norm["notice_uid"]:
            existing = by_notice.get(norm["notice_uid"])
            if existing is None or _process_rank(norm) > _process_rank(existing):
                by_notice[norm["notice_uid"]] = norm
    by_portfolio_best = {k: _pick_best_process(v) for k, v in by_portfolio.items()}
    return by_portfolio, by_portfolio_best, by_notice


def load_secop2_unified(
    entity: Entity,
    anio: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    nits = resolve_nits_secop_ii(entity)
    codigos = resolve_codigos_secop_ii(entity)
    nombres = resolve_nombres_secop_ii(entity)

    contracts_raw, err_c = fetch_secop2_contracts(nits, anio, codigos=codigos, nombres=nombres)
    processes_raw, err_p = fetch_secop2_processes(nits, anio, codigos=codigos, nombres=nombres)

    process_rows = list(processes_raw)
    by_portfolio, by_portfolio_best, by_notice = _index_processes(process_rows)

    missing_portfolios = []
    for row in contracts_raw:
        portfolio = str(row.get("proceso_de_compra") or "").strip()
        if portfolio and portfolio not in by_portfolio_best:
            missing_portfolios.append(portfolio)
    if missing_portfolios:
        extra_raw, _ = fetch_secop2_processes_by_portfolios(
            nits, missing_portfolios, codigos=codigos, nombres=nombres,
        )
        if extra_raw:
            process_rows.extend(extra_raw)
            extra_by_portfolio, extra_best, extra_notice = _index_processes(extra_raw)
            for portfolio, procs in extra_by_portfolio.items():
                by_portfolio[portfolio].extend(procs)
                by_portfolio_best[portfolio] = _pick_best_process(by_portfolio[portfolio])
            for notice, proc in extra_notice.items():
                existing = by_notice.get(notice)
                if existing is None or _process_rank(proc) > _process_rank(existing):
                    by_notice[notice] = proc

    unified: list[dict[str, Any]] = []
    linked_process_ids: set[str] = set()
    contract_portfolios: set[str] = set()
    contract_ref_bases: set[str] = set()

    def mark_portfolio_linked(portfolio_id: str | None) -> None:
        if not portfolio_id:
            return
        contract_portfolios.add(portfolio_id)
        for proc in by_portfolio.get(portfolio_id, []):
            linked_process_ids.add(proc["id"])

    for row in contracts_raw:
        norm = normalize_secop2_contract(row)
        portfolio = norm.get("portfolio_id")
        notice = norm.get("notice_uid") or extract_notice_uid(row.get("urlproceso"))
        contract_ref_bases.add(_base_referencia(norm.get("referencia")))
        proc = None
        if portfolio and portfolio in by_portfolio_best:
            proc = by_portfolio_best[portfolio]
        elif notice and notice in by_notice:
            proc = by_notice[notice]
        if proc:
            norm["proceso_vinculado"] = public_record(proc)
            proc_ref = proc.get("referencia")
            if proc_ref:
                norm["numero_proceso"] = proc_ref
                norm["referencia"] = proc_ref
            linked_process_ids.add(proc["id"])
            mark_portfolio_linked(proc.get("portfolio_id"))
        if portfolio:
            mark_portfolio_linked(portfolio)
        unified.append(norm)

    seen_orphan_portfolios: set[str] = set()
    for row in processes_raw:
        norm = normalize_secop2_process(row)
        pid = norm["id"]
        portfolio = norm.get("portfolio_id")
        ref_base = _base_referencia(norm.get("referencia"))

        if pid in linked_process_ids:
            continue
        if portfolio and portfolio in contract_portfolios:
            continue
        if ref_base and ref_base in contract_ref_bases:
            continue
        if portfolio:
            if portfolio in seen_orphan_portfolios:
                continue
            seen_orphan_portfolios.add(portfolio)
            siblings = by_portfolio.get(portfolio, [norm])
            norm = _pick_best_process(siblings)

        unified.append(norm)

    unified = enrich_secop2(unified)

    meta = {
        "anio": anio,
        "total_contratos": len(contracts_raw),
        "total_procesos": len(processes_raw),
        "total_unificado": len(unified),
        "codigos_entidad": codigos,
        "nombres_entidad": nombres,
        "errors": [e for e in (err_c, err_p) if e],
    }
    return unified, meta


def load_secop1_normalized(
    entity: Entity,
    anio: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    nits = resolve_nits_secop_i(entity)
    codigos = resolve_codigos_secop_i(entity)
    nombres = resolve_nombres_secop_i(entity)
    rows, err = fetch_secop1_contracts(nits, anio, codigos=codigos, nombres=nombres)
    records = [normalize_secop1(r) for r in rows]
    meta = {
        "anio": anio,
        "total": len(records),
        "codigos_entidad": codigos,
        "nombres_entidad": nombres,
        "errors": [err] if err else [],
    }
    return records, meta
