"""Bootstrap: crea roles por defecto + admin inicial.

Idempotente: se ejecuta automáticamente en cada arranque del contenedor.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.services.clerk import ClerkServiceError, ensure_user
from apps.rbac.models import RoleMeta

User = get_user_model()
logger = logging.getLogger(__name__)


DEFAULT_ROLES: dict[str, dict] = {
    "superadmin": {
        "description": "Superadministrador con acceso total al sistema.",
        "is_system": True,
        "perms": "*",  # marcador → todos
    },
    "admin": {
        "description": "Administrador con permisos de gestión.",
        "is_system": True,
        "perms": "*",
    },
    "secretario": {
        "description": "Secretario: gestión de documentos y trámites.",
        "is_system": True,
        "perms": [],
    },
    "ciudadano": {
        "description": "Ciudadano: acceso a servicios y consultas.",
        "is_system": True,
        "perms": [],
    },
    "contratista": {
        "description": "Contratista: gestión de contratos y proyectos.",
        "is_system": True,
        "perms": [],
    },
    "auditor": {
        "description": "Auditor: revisión y control de procesos.",
        "is_system": True,
        "perms": [],
    },
}


class Command(BaseCommand):
    help = "Crea roles por defecto y el administrador inicial."

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        for name, cfg in DEFAULT_ROLES.items():
            group, created = Group.objects.get_or_create(name=name)
            meta, _ = RoleMeta.objects.get_or_create(group=group)
            meta.description = cfg["description"]
            meta.is_system = cfg["is_system"]
            meta.save()
            if cfg["perms"] == "*":
                group.permissions.set(Permission.objects.all())
            self.stdout.write(self.style.SUCCESS(
                f"  rol {'creado' if created else 'existente'}: {name}"
            ))

        email = (settings.INITIAL_ADMIN_EMAIL or "").strip().lower()
        password = settings.INITIAL_ADMIN_PASSWORD or ""
        name = settings.INITIAL_ADMIN_NAME or "Admin"

        if not email or not password:
            self.stdout.write(self.style.WARNING(
                "INITIAL_ADMIN_EMAIL/PASSWORD no definidos; se omite admin."
            ))
            return

        user = User.objects.filter(email__iexact=email).first()
        if user:
            if user.is_superuser or user.role == "superadmin":
                sa = Group.objects.get(name="superadmin")
                user.groups.add(sa)
                self.stdout.write(self.style.SUCCESS(
                    f"  superadmin verificado: {email}"
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"  usuario existente (sin cambios de rol): {email}"
                ))
        else:
            user = User.objects.create_superuser(
                email=email, password=password, full_name=name
            )
            user.groups.add(Group.objects.get(name="superadmin"))
            user.role = "superadmin"
            user.save(update_fields=["role"])
            self.stdout.write(self.style.SUCCESS(f"  superadmin creado: {email}"))

        self._sync_clerk_superadmin(user, email, password, name)

    def _sync_clerk_superadmin(
        self, user: User, email: str, password: str, full_name: str
    ) -> None:
        if not settings.CLERK_SECRET_KEY:
            self.stdout.write(self.style.WARNING(
                "CLERK_SECRET_KEY no definida; se omite sync Clerk."
            ))
            return
        if user.clerk_id:
            self.stdout.write(self.style.SUCCESS(
                f"  clerk_id existente: {user.clerk_id}"
            ))
            return
        try:
            clerk_id = ensure_user(email=email, password=password, full_name=full_name)
            user.clerk_id = clerk_id
            user.save(update_fields=["clerk_id"])
            self.stdout.write(self.style.SUCCESS(
                f"  superadmin vinculado a Clerk: {clerk_id}"
            ))
        except ClerkServiceError as exc:
            logger.warning("Clerk sync failed for %s: %s", email, exc)
            self.stdout.write(self.style.WARNING(
                f"  no se pudo vincular Clerk: {exc}"
            ))
