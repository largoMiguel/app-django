"""Cliente OpenAI compartido con logging de tokens y auditoría."""
from __future__ import annotations

import logging
import time
from typing import Any

from django.conf import settings
from openai import OpenAI

from .models import AIInteraction

logger = logging.getLogger(__name__)

_clients: dict[str, OpenAI] = {}


def get_openai_client(api_key: str | None = None) -> OpenAI:
    """Retorna cliente OpenAI cacheado por API key."""
    key = api_key or settings.OPENAI_API_KEY
    if not key:
        raise ValueError("OPENAI_API_KEY no configurada.")
    if key not in _clients:
        _clients[key] = OpenAI(api_key=key)
    return _clients[key]


def get_model_for_feature(feature: str) -> str:
    """Selecciona modelo según feature."""
    if feature in ("pdm_copilot", "pdm_chat_public", "global_copilot"):
        return settings.PDM_CHAT_MODEL or settings.OPENAI_MODEL
    return settings.OPENAI_MODEL


def get_api_key_for_feature(feature: str) -> str:
    """Selecciona API key según feature."""
    if feature in ("pdm_copilot", "pdm_chat_public", "global_copilot"):
        return settings.PDM_CHAT_OPENAI_API_KEY or settings.OPENAI_API_KEY
    return settings.OPENAI_API_KEY


def log_interaction(
    feature: str,
    model: str,
    usage: Any | None = None,
    entity_id: int | None = None,
    user_id: int | None = None,
    latency_ms: int | None = None,
    success: bool = True,
    error_message: str = "",
    metadata: dict | None = None,
) -> AIInteraction:
    """Registra interacción de IA para auditoría y control de costos."""
    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    if usage:
        prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
        completion_tokens = getattr(usage, "completion_tokens", 0) or 0
        total_tokens = getattr(usage, "total_tokens", 0) or (prompt_tokens + completion_tokens)

    return AIInteraction.objects.create(
        entity_id=entity_id,
        user_id=user_id,
        feature=feature,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        latency_ms=latency_ms,
        success=success,
        error_message=error_message[:2000],
        metadata=metadata or {},
    )


def chat_completion(
    feature: str,
    messages: list[dict[str, str]],
    *,
    entity_id: int | None = None,
    user_id: int | None = None,
    model: str | None = None,
    temperature: float = 0.3,
    response_format: dict | None = None,
    tools: list | None = None,
    tool_choice: str | None = None,
    metadata: dict | None = None,
) -> Any:
    """Llamada a chat completions con logging automático."""
    api_key = get_api_key_for_feature(feature)
    client = get_openai_client(api_key)
    model = model or get_model_for_feature(feature)

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format
    if tools:
        kwargs["tools"] = tools
    if tool_choice:
        kwargs["tool_choice"] = tool_choice

    start = time.monotonic()
    try:
        response = client.chat.completions.create(**kwargs)
        latency_ms = int((time.monotonic() - start) * 1000)
        log_interaction(
            feature=feature,
            model=model,
            usage=response.usage,
            entity_id=entity_id,
            user_id=user_id,
            latency_ms=latency_ms,
            success=True,
            metadata=metadata,
        )
        return response
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        log_interaction(
            feature=feature,
            model=model,
            entity_id=entity_id,
            user_id=user_id,
            latency_ms=latency_ms,
            success=False,
            error_message=str(exc),
            metadata=metadata,
        )
        raise


def create_embedding(
    text: str,
    *,
    entity_id: int | None = None,
    user_id: int | None = None,
) -> list[float]:
    """Genera embedding con text-embedding-3-small."""
    api_key = get_api_key_for_feature("embedding")
    client = get_openai_client(api_key)
    model = settings.AI_EMBEDDING_MODEL

    start = time.monotonic()
    try:
        response = client.embeddings.create(model=model, input=text[:8000])
        latency_ms = int((time.monotonic() - start) * 1000)
        log_interaction(
            feature="embedding",
            model=model,
            usage=response.usage,
            entity_id=entity_id,
            user_id=user_id,
            latency_ms=latency_ms,
        )
        return response.data[0].embedding
    except Exception as exc:
        latency_ms = int((time.monotonic() - start) * 1000)
        log_interaction(
            feature="embedding",
            model=model,
            entity_id=entity_id,
            user_id=user_id,
            latency_ms=latency_ms,
            success=False,
            error_message=str(exc),
        )
        raise
