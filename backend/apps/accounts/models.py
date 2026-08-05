"""Usuario local (email + Clerk) con RBAC por grupos Django."""
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
        ("contratista", "Contratista"),
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
    email_firma = models.TextField(
        blank=True,
        default="",
        help_text="Pie de página / firma incluida al responder PQRS por correo.",
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
                condition=~models.Q(role="secretario") | models.Q(secretaria__isnull=False),
                name="user_secretario_requires_secretaria",
            ),
            models.CheckConstraint(
                condition=~models.Q(role="contratista") | models.Q(secretaria__isnull=False),
                name="user_contratista_requires_secretaria",
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
        active = getattr(self, "_active_role", None)
        if active:
            return [active]
        names = list(self.groups.values_list("name", flat=True))
        if self.role and self.role not in names:
            names.append(self.role)
        return names


class UserEntityMembership(models.Model):
    """Membresía de un usuario en una entidad (rol, secretaría y módulos por entidad)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="memberships",
        db_column="user_id",
    )
    entity = models.ForeignKey(
        "entities.Entity",
        on_delete=models.CASCADE,
        related_name="memberships",
        db_column="entity_id",
    )
    role = models.CharField(max_length=20, choices=User.ROLE_CHOICES, blank=True, default="")
    secretaria = models.ForeignKey(
        "entities.Secretaria",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memberships",
        db_column="secretaria_id",
    )
    enabled_modules = models.JSONField(default=list, blank=True)
    supervisor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_memberships",
        db_column="supervisor_id",
        help_text="Supervisor directo (p. ej. secretario del contratista).",
    )
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["entity__name", "user__email"]
        verbose_name = "Membresía de entidad"
        verbose_name_plural = "Membresías de entidad"
        constraints = [
            models.UniqueConstraint(fields=("user", "entity"), name="unique_user_entity_membership"),
            models.CheckConstraint(
                condition=~models.Q(role="secretario") | models.Q(secretaria__isnull=False),
                name="membership_secretario_requires_secretaria",
            ),
            models.CheckConstraint(
                condition=~models.Q(role="contratista") | models.Q(secretaria__isnull=False),
                name="membership_contratista_requires_secretaria",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} @ {self.entity.name} ({self.role})"

    def clean(self):
        super().clean()
        if self.secretaria_id and self.entity_id:
            sec_entity = getattr(self.secretaria, "entity_id", None)
            if sec_entity and sec_entity != self.entity_id:
                raise ValidationError(
                    {"secretaria": "La secretaría no pertenece a la entidad de la membresía."}
                )
        if self.supervisor_id and self.supervisor_id == self.user_id:
            raise ValidationError({"supervisor": "Un usuario no puede ser su propio supervisor."})
