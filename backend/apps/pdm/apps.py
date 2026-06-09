from django.apps import AppConfig


class PdmConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pdm"

    def ready(self):
        import apps.pdm.signals  # noqa: F401
