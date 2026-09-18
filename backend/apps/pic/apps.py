from django.apps import AppConfig


class PicConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pic"
    verbose_name = "PIC — Plan de Intervenciones Colectivas"

    def ready(self):
        import apps.pic.signals  # noqa: F401
