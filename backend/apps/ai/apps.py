from django.apps import AppConfig


class AiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ai"
    verbose_name = "IA / Copiloto"

    def ready(self):
        import apps.ai.signals  # noqa: F401
