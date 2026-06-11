"""Servicio de embeddings y búsqueda semántica con pgvector."""
from __future__ import annotations

import logging
from typing import Any

from django.db.models import F, Q
from pgvector.django import CosineDistance

from apps.ai.client import create_embedding
from apps.ai.models import ContentEmbedding

logger = logging.getLogger(__name__)


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


def _keyword_search_pqrs(
    entity_id: int,
    query: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Fallback: búsqueda por texto en PQRS cuando no hay embeddings."""
    from apps.pqrs.models import PQRS

    terms = [t.strip() for t in query.split() if len(t.strip()) >= 3]
    if not terms:
        terms = [query.strip()]

    qs = PQRS.objects.filter(entity_id=entity_id)
    q_filter = Q()
    for term in terms[:5]:
        q_filter |= (
            Q(asunto__icontains=term)
            | Q(descripcion__icontains=term)
            | Q(respuesta__icontains=term)
            | Q(numero_radicado__icontains=term)
            | Q(nombre_ciudadano__icontains=term)
        )
    results = []
    for pqrs in qs.filter(q_filter).order_by("-fecha_solicitud")[:limit]:
        snippet = f"{pqrs.asunto or ''}\n{pqrs.descripcion or ''}".strip()[:300]
        results.append({
            "content_type": ContentEmbedding.ContentType.PQRS_DESCRIPCION,
            "object_id": pqrs.id,
            "texto": snippet,
            "similarity": 0.5,
            "metadata": {
                "numero_radicado": pqrs.numero_radicado,
                "estado": pqrs.estado,
                "search_mode": "keyword",
            },
        })
    return results


def semantic_search(
    entity_id: int,
    query: str,
    *,
    content_types: list[str] | None = None,
    limit: int = 10,
    min_similarity: float = 0.35,
) -> list[dict[str, Any]]:
    """Búsqueda semántica por similitud coseno + fallback por texto."""
    query = (query or "").strip()
    if not query:
        return []

    indexed_count = ContentEmbedding.objects.filter(entity_id=entity_id).count()
    results: list[dict[str, Any]] = []

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
                .order_by("distance")[:limit]
            )
            results = [
                {
                    "content_type": r.content_type,
                    "object_id": r.object_id,
                    "texto": r.texto[:300],
                    "similarity": round(float(r.similarity), 4),
                    "metadata": {**(r.metadata or {}), "search_mode": "semantic"},
                }
                for r in vector_results
            ]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Embedding de búsqueda falló: %s", exc)

    # Fallback por texto si no hay embeddings o sin resultados semánticos
    if not results and (
        not content_types
        or "pqrs_descripcion" in content_types
        or "pqrs_respuesta" in content_types
    ):
        results = _keyword_search_pqrs(entity_id, query, limit=limit)

    return results


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
