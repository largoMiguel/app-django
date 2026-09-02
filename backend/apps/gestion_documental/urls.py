"""Rutas API — Gestión documental."""
from rest_framework.routers import DefaultRouter

from .views import (
    DisposicionViewSet,
    ExpedienteViewSet,
    FuidViewSet,
    GestionDocumentalExportViewSet,
    GestionDocumentalStatsViewSet,
    InstrumentoViewSet,
    SerieViewSet,
    TransferenciaViewSet,
    UnidadAdministrativaViewSet,
)

router = DefaultRouter()
router.register("gestion-documental/stats", GestionDocumentalStatsViewSet, basename="gd-stats")
router.register("gestion-documental/export", GestionDocumentalExportViewSet, basename="gd-export")
router.register("gestion-documental/instrumentos", InstrumentoViewSet, basename="gd-instrumentos")
router.register("gestion-documental/unidades", UnidadAdministrativaViewSet, basename="gd-unidades")
router.register("gestion-documental/series", SerieViewSet, basename="gd-series")
router.register("gestion-documental/expedientes", ExpedienteViewSet, basename="gd-expedientes")
router.register("gestion-documental/fuid", FuidViewSet, basename="gd-fuid")
router.register("gestion-documental/transferencias", TransferenciaViewSet, basename="gd-transferencias")
router.register("gestion-documental/disposiciones", DisposicionViewSet, basename="gd-disposiciones")

urlpatterns = router.urls
