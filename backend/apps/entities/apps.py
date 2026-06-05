from django.apps import AppConfig


class EntitiesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.entities"
    verbose_name = "Entidades"

    def ready(self):
        from . import signals  # noqa: F401
