"""Señales de entidad — defaults del chat PDM público."""
from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Entity


def default_pdm_chat_intro(entity: Entity) -> str:
    plan = entity.plan_name or "Plan de Desarrollo Municipal"
    return (
        f"Soy el asistente virtual de {entity.name}. "
        f"Puedo consultar en tiempo real el {plan}: productos, metas, avances, "
        f"ejecución presupuestal, contratos y evidencias. "
        f"¿En qué puedo ayudarte?"
    )


def default_pdm_chat_sugerencias() -> list[str]:
    return [
        "¿Cuáles son los productos con mayor avance este año?",
        "¿Cuánto se ha ejecutado del presupuesto del PDM?",
        "¿Qué contratos están asociados al producto X?",
        "¿Qué evidencias hay registradas para las actividades del PDM?",
    ]


@receiver(post_save, sender=Entity)
def seed_pdm_chat_defaults(sender, instance: Entity, **kwargs):
    """Al activar el chat PDM, sembrar intro y sugerencias si están vacías."""
    if not instance.enable_pdm_chat:
        return
    updates: dict = {}
    if not (instance.pdm_chat_intro or "").strip():
        updates["pdm_chat_intro"] = default_pdm_chat_intro(instance)
    if not instance.pdm_chat_sugerencias:
        updates["pdm_chat_sugerencias"] = default_pdm_chat_sugerencias()
    if updates:
        Entity.objects.filter(pk=instance.pk).update(**updates)
