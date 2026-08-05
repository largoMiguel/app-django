from django.apps import AppConfig


class PlanesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.planes"
    verbose_name = "Planes Institucionales (Decreto 612)"

    def ready(self) -> None:
        import apps.planes.signals  # noqa: F401
