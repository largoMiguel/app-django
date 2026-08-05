"""Señales de membresías multi-entidad."""
from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.memberships import cascade_modules_to_supervised, sync_user_cache_from_membership
from apps.accounts.models import UserEntityMembership


@receiver(post_save, sender=UserEntityMembership)
def membership_post_save(sender, instance: UserEntityMembership, **kwargs):
    if instance.is_default:
        sync_user_cache_from_membership(instance)
    if instance.role == "secretario":
        cascade_modules_to_supervised(instance)
