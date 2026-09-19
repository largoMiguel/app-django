"""Servicio de embeddings y búsqueda semántica con pgvector."""
from __future__ import annotations

import logging
import re
from typing import Any

from django.db.models import F, Q
from pgvector.django import CosineDistance

from apps.ai.client import create_embedding
from apps.ai.models import ContentEmbedding

logger = logging.getLogger(__name__)

_PQRS_FIELD_LABELS: dict[str, str] = {
    "numero_radicado": "radicado",
    "asunto": "asunto",
    "descripcion": "descripción",
    "respuesta": "respuesta",
    "nombre_ciudadano": "ciudadano",
    "cedula_ciudadano": "cédula",
    "email_ciudadano": "correo",
    "tipo_solicitud": "tipo",
    "justificacion_asignacion": "asignación",
}


def index_text(
    entity_id: int,
    content_type: str,
    object_id: int,
    texto: str,
    metadata: dict | None = None,
) -> ContentEmbedding | None:
    """Indexa texto generando embedding y guardando en pgvector."""
    texto = (texto or "").strip()
    if len(texto) < 10:
        return None

    try:
        vector = create_embedding(texto, entity_id=entity_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Embedding falló para %s:%s: %s", content_type, object_id, exc)
        return None

    emb, _ = ContentEmbedding.objects.update_or_create(
        content_type=content_type,
        object_id=object_id,
        defaults={
            "entity_id": entity_id,
            "texto": texto[:4000],
            "embedding": vector,
            "metadata": metadata or {},
        },
    )
    return emb


def _pqrs_search_terms(query: str) -> list[str]:
    """Tokeniza la consulta; admite términos cortos si parecen radicado o números."""
    raw = (query or "").strip()
    if not raw:
        return []

    parts = re.split(r"\s+", raw)
    terms: list[str] = []
    for part in parts:
        token = part.strip(".,;:")
        if not token:
            continue
        if len(token) >= 3:
            terms.append(token)
        elif token.isdigit() or re.search(r"\d", token):
            terms.append(token)
    if not terms:
        terms = [raw]
    return terms[:8]


def _pqrs_keyword_score_and_fields(pqrs, query: str, terms: list[str]) -> tuple[float, list[str]]:
    """Puntúa coincidencias por campo y devuelve etiquetas legibles."""
    q_lower = query.lower()
    matched: list[str] = []
    score = 0.0

    radicado = (pqrs.numero_radicado or "").lower()
    if q_lower and radicado and q_lower in radicado:
        score += 0.95
        matched.append(_PQRS_FIELD_LABELS["numero_radicado"])
    elif terms and radicado:
        for term in terms:
            if term.lower() in radicado:
                score += 0.85
                matched.append(_PQRS_FIELD_LABELS["numero_radicado"])
                break

    field_map = {
        "asunto": pqrs.asunto or "",
        "descripcion": pqrs.descripcion or "",
        "respuesta": pqrs.respuesta or "",
        "nombre_ciudadano": pqrs.nombre_ciudadano or "",
        "cedula_ciudadano": pqrs.cedula_ciudadano or "",
        "email_ciudadano": pqrs.email_ciudadano or "",
        "tipo_solicitud": pqrs.tipo_solicitud or "",
        "justificacion_asignacion": pqrs.justificacion_asignacion or "",
    }

    for field_key, value in field_map.items():
        if not value:
            continue
        val_lower = value.lower()
        label = _PQRS_FIELD_LABELS[field_key]
        if q_lower and len(q_lower) >= 4 and q_lower in val_lower:
            score += 0.55
            if label not in matched:
                matched.append(label)
            continue
        hits = sum(1 for t in terms if t.lower() in val_lower)
        if hits:
            score += min(0.45, 0.12 * hits)
            if label not in matched:
                matched.append(label)

    score = min(1.0, score)
    return score, matched


def _keyword_search_pqrs(
    entity_id: int,
    query: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Búsqueda por texto en campos PQRS con puntuación por coincidencias."""
    from apps.pqrs.models import PQRS

    terms = _pqrs_search_terms(query)
    qs = PQRS.objects.filter(entity_id=entity_id)

    q_filter = Q()
    for term in terms:
        q_filter |= (
            Q(asunto__icontains=term)
            | Q(descripcion__icontains=term)
            | Q(respuesta__icontains=term)
            | Q(numero_radicado__icontains=term)
            | Q(nombre_ciudadano__icontains=term)
            | Q(cedula_ciudadano__icontains=term)
            | Q(email_ciudadano__icontains=term)
            | Q(tipo_solicitud__icontains=term)
            | Q(justificacion_asignacion__icontains=term)
        )
    if len(query.strip()) >= 2:
        q_filter |= Q(numero_radicado__icontains=query.strip())

    candidates = qs.filter(q_filter).order_by("-fecha_solicitud")[: max(limit * 4, 24)]
    scored: list[tuple[float, Any, list[str]]] = []
    for pqrs in candidates:
        score, matched = _pqrs_keyword_score_and_fields(pqrs, query, terms)
        if score <= 0:
            continue
        scored.append((score, pqrs, matched))

    scored.sort(key=lambda x: (-x[0], -(x[1].fecha_solicitud.timestamp() if x[1].fecha_solicitud else 0)))

    results: list[dict[str, Any]] = []
    for score, pqrs, matched in scored[:limit]:
        asunto = (pqrs.asunto or "").strip()
        snippet_body = (pqrs.descripcion or pqrs.respuesta or "")[:220].strip()
        snippet = f"{asunto}\n{snippet_body}".strip()[:300]
        match_summary = (
            f"Coincide en: {', '.join(matched)}"
            if matched
            else "Coincidencia por texto"
        )
        results.append({
            "content_type": ContentEmbedding.ContentType.PQRS_DESCRIPCION,
            "object_id": pqrs.id,
            "texto": snippet,
            "similarity": round(score, 4),
            "metadata": {
                "numero_radicado": pqrs.numero_radicado,
                "estado": pqrs.estado,
                "tipo": pqrs.tipo_solicitud,
                "asunto": asunto[:120],
                "search_mode": "keyword",
                "matched_fields": matched,
                "match_summary": match_summary,
            },
        })
    return results


def _enrich_pqrs_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Completa metadatos PQRS desde la base cuando faltan."""
    if not results:
        return results
    from apps.pqrs.models import PQRS

    ids = {r["object_id"] for r in results}
    by_id = {
        p.id: p
        for p in PQRS.objects.filter(id__in=ids).only(
            "id",
            "numero_radicado",
            "estado",
            "tipo_solicitud",
            "asunto",
        )
    }
    for row in results:
        pqrs = by_id.get(row["object_id"])
        if not pqrs:
            continue
        meta = row.setdefault("metadata", {})
        meta.setdefault("numero_radicado", pqrs.numero_radicado)
        meta.setdefault("estado", pqrs.estado)
        meta.setdefault("tipo", pqrs.tipo_solicitud)
        meta.setdefault("asunto", (pqrs.asunto or "")[:120])
    return results


def _merge_pqrs_search_results(
    semantic: list[dict[str, Any]],
    keyword: list[dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    """Unifica por PQRS (object_id), conserva mejor score y combina explicaciones."""
    merged: dict[int, dict[str, Any]] = {}

    def upsert(item: dict[str, Any]) -> None:
        oid = int(item["object_id"])
        meta = dict(item.get("metadata") or {})
        if oid not in merged:
            merged[oid] = {**item, "metadata": meta}
            return
        current = merged[oid]
        if item["similarity"] > current["similarity"]:
            current["similarity"] = item["similarity"]
            current["texto"] = item.get("texto") or current.get("texto")
            if item.get("content_type"):
                current["content_type"] = item["content_type"]
        modes = {current["metadata"].get("search_mode"), meta.get("search_mode")}
        modes.discard(None)
        if len(modes) > 1:
            current["metadata"]["search_mode"] = "hybrid"
        elif meta.get("search_mode"):
            current["metadata"]["search_mode"] = meta["search_mode"]

        kw_fields = meta.get("matched_fields") or []
        cur_fields = current["metadata"].get("matched_fields") or []
        combined = list(dict.fromkeys([*(cur_fields if isinstance(cur_fields, list) else []), *kw_fields]))
        if combined:
            current["metadata"]["matched_fields"] = combined
            current["metadata"]["match_summary"] = f"Coincide en: {', '.join(combined)}"
        elif current["metadata"].get("search_mode") == "semantic":
            sim_pct = int(float(current["similarity"]) * 100)
            current["metadata"]["match_summary"] = f"Relacionada por significado ({sim_pct}% similitud)"

    for row in semantic:
        upsert(row)
    for row in keyword:
        upsert(row)

    ordered = sorted(merged.values(), key=lambda r: (-float(r["similarity"]), r["object_id"]))
    return ordered[:limit]


def semantic_search(
    entity_id: int,
    query: str,
    *,
    content_types: list[str] | None = None,
    limit: int = 10,
    min_similarity: float = 0.32,
) -> list[dict[str, Any]]:
    """Búsqueda híbrida: similitud coseno + coincidencias por texto en PQRS."""
    query = (query or "").strip()
    if not query:
        return []

    pqrs_types_requested = not content_types or any(
        t in content_types for t in ("pqrs_descripcion", "pqrs_respuesta")
    )

    indexed_count = ContentEmbedding.objects.filter(entity_id=entity_id).count()
    semantic_results: list[dict[str, Any]] = []

    if indexed_count > 0:
        try:
            query_vector = create_embedding(query, entity_id=entity_id)
            qs = ContentEmbedding.objects.filter(entity_id=entity_id)
            if content_types:
                qs = qs.filter(content_type__in=content_types)

            vector_results = (
                qs.annotate(distance=CosineDistance("embedding", query_vector))
                .annotate(similarity=1 - F("distance"))
                .filter(similarity__gte=min_similarity)
                .order_by("distance")[: max(limit * 2, 16)]
            )
            for r in vector_results:
                meta = {**(r.metadata or {}), "search_mode": "semantic"}
                sim_pct = int(float(r.similarity) * 100)
                meta.setdefault(
                    "match_summary",
                    f"Relacionada por significado ({sim_pct}% similitud)",
                )
                semantic_results.append({
                    "content_type": r.content_type,
                    "object_id": r.object_id,
                    "texto": r.texto[:300],
                    "similarity": round(float(r.similarity), 4),
                    "metadata": meta,
                })
        except Exception as exc:  # noqa: BLE001
            logger.warning("Embedding de búsqueda falló: %s", exc)

    keyword_results: list[dict[str, Any]] = []
    if pqrs_types_requested:
        keyword_results = _keyword_search_pqrs(entity_id, query, limit=max(limit * 2, 16))

    if semantic_results and keyword_results:
        results = _merge_pqrs_search_results(semantic_results, keyword_results, limit=limit)
    elif semantic_results:
        by_id: dict[int, dict[str, Any]] = {}
        for row in semantic_results:
            oid = int(row["object_id"])
            if oid not in by_id or row["similarity"] > by_id[oid]["similarity"]:
                by_id[oid] = row
        results = sorted(by_id.values(), key=lambda r: -float(r["similarity"]))[:limit]
    else:
        results = keyword_results[:limit]

    return _enrich_pqrs_results(results)


def find_similar(
    entity_id: int,
    content_type: str,
    object_id: int,
    *,
    limit: int = 5,
    min_similarity: float = 0.75,
    exclude_same: bool = True,
) -> list[dict[str, Any]]:
    """Encuentra contenido similar a un objeto ya indexado."""
    source = ContentEmbedding.objects.filter(
        content_type=content_type,
        object_id=object_id,
        entity_id=entity_id,
    ).first()
    if not source:
        return []

    qs = ContentEmbedding.objects.filter(entity_id=entity_id, content_type=content_type)
    if exclude_same:
        qs = qs.exclude(object_id=object_id)

    results = (
        qs.annotate(distance=CosineDistance("embedding", source.embedding))
        .annotate(similarity=1 - F("distance"))
        .filter(similarity__gte=min_similarity)
        .order_by("distance")[:limit]
    )

    return [
        {
            "object_id": r.object_id,
            "texto": r.texto[:300],
            "similarity": round(float(r.similarity), 4),
            "metadata": r.metadata,
        }
        for r in results
    ]
