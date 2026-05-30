"""Bootstrap: crea roles por defecto + admin inicial.

Idempotente: se ejecuta automáticamente en cada arranque del contenedor.
"""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.rbac.models import RoleMeta

User = get_user_model()


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

        if User.objects.filter(email__iexact=email).exists():
            user = User.objects.get(email__iexact=email)
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
            return

        user = User.objects.create_superuser(
            email=email, password=password, full_name=name
        )
        user.groups.add(Group.objects.get(name="superadmin"))
        user.role = "superadmin"
        user.save(update_fields=["role"])
        self.stdout.write(self.style.SUCCESS(f"  superadmin creado: {email}"))
