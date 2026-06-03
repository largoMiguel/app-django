"""User model with email login + RBAC link."""
from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("El usuario debe tener un email")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser debe tener is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser debe tener is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user keyed by email. RBAC piggybacks on Django auth groups."""

    ROLE_CHOICES = (
        ("superadmin", "Superadmin"),
        ("admin", "Admin"),
        ("secretario", "Secretario"),
        ("ciudadano", "Ciudadano"),
    )

    email = models.EmailField(unique=True, db_index=True)
    clerk_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="ID del usuario en Clerk (user_xxx).",
    )
    full_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    # Multi-tenancy + rol rápido (espejo del grupo principal)
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        db_column="entity_id",
    )
    secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        db_column="secretaria_id",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, blank=True, default="")
    enabled_modules = models.JSONField(
        default=list,
        blank=True,
        help_text="Módulos específicos habilitados para este usuario (subset de la entidad). Para secretarios.",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = ["full_name"]

    objects = UserManager()

    class Meta:
        ordering = ["-date_joined"]
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        constraints = [
            models.CheckConstraint(
                check=~models.Q(role="secretario") | models.Q(secretaria__isnull=False),
                name="user_secretario_requires_secretaria",
            ),
        ]

    def __str__(self) -> str:
        return self.email

    def clean(self):
        super().clean()
        if self.secretaria_id and self.entity_id:
            secretaria_entity_id = getattr(self.secretaria, "entity_id", None)
            if secretaria_entity_id and secretaria_entity_id != self.entity_id:
                raise ValidationError(
                    {"secretaria": "La secretaría asignada no pertenece a la misma entidad del usuario."}
                )

    @property
    def role_names(self) -> list[str]:
        names = list(self.groups.values_list("name", flat=True))
        if self.role and self.role not in names:
            names.append(self.role)
        return names
