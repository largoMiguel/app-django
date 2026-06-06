from django.apps import AppConfig


class PqrsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pqrs"
    verbose_name = "PQRS"

    def ready(self):
        import apps.pqrs.signals  # noqa: F401
