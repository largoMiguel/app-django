"""Señales de membresías multi-entidad."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.auth_cache import invalidate_user_auth_cache
from apps.accounts.memberships import cascade_modules_to_supervised, sync_user_cache_from_membership
from apps.accounts.models import UserEntityMembership

User = get_user_model()


@receiver(post_save, sender=UserEntityMembership)
def membership_post_save(sender, instance: UserEntityMembership, **kwargs):
    invalidate_user_auth_cache(user_id=instance.user_id)
    if instance.is_default:
        sync_user_cache_from_membership(instance)
    if instance.role == "secretario":
        cascade_modules_to_supervised(instance)


@receiver(post_save, sender=User)
def user_post_save(sender, instance, **kwargs):
    invalidate_user_auth_cache(clerk_id=instance.clerk_id or None, user_id=instance.pk)


@receiver(post_save)
def entity_post_save_invalidate_auth(sender, instance, **kwargs):
    from apps.entities.models import Entity

    if sender is not Entity:
        return
    for uid in UserEntityMembership.objects.filter(entity_id=instance.pk).values_list(
        "user_id", flat=True
    ):
        invalidate_user_auth_cache(user_id=uid)
