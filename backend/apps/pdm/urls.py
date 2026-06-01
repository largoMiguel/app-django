from django.urls import path

from .bpin_view import BpinDetailView
from .views import (
    PdmActividadCreateView,
    PdmActividadDetailView,
    PdmActividadesPorProductoView,
    PdmAsignarResponsableView,
    PdmContratosUploadView,
    PdmContratosView,
    PdmEjecucionProductoView,
    PdmEjecucionResumenAnualEntidadView,
    PdmEjecucionUploadView,
    PdmEvidenciaView,
    PdmMetaView,
    PdmProductoDetailView,
    PdmProductosListView,
    PdmStatsView,
    PdmStatusView,
    PdmUploadView,
)

urlpatterns = [
    path("pdm/v2/<slug:slug>/status", PdmStatusView.as_view()),
    path("pdm/v2/<slug:slug>/upload", PdmUploadView.as_view()),
    path("pdm/v2/<slug:slug>/meta", PdmMetaView.as_view()),
    path("pdm/v2/<slug:slug>/stats", PdmStatsView.as_view()),
    path("pdm/v2/<slug:slug>/productos", PdmProductosListView.as_view()),
    path("pdm/v2/<slug:slug>/productos/<str:codigo_producto>", PdmProductoDetailView.as_view()),
    path("pdm/v2/<slug:slug>/productos/<str:codigo_producto>/actividades", PdmActividadesPorProductoView.as_view()),
    path("pdm/v2/<slug:slug>/actividades", PdmActividadCreateView.as_view()),
    path("pdm/v2/<slug:slug>/actividades/<int:actividad_id>", PdmActividadDetailView.as_view()),
    path("pdm/v2/<slug:slug>/actividades/<int:actividad_id>/evidencia", PdmEvidenciaView.as_view()),
    path("pdm/v2/<slug:slug>/productos/<str:codigo_producto>/responsable", PdmAsignarResponsableView.as_view()),
    path("pdm/ejecucion/upload", PdmEjecucionUploadView.as_view()),
    path("pdm/ejecucion/resumen-anual-entidad", PdmEjecucionResumenAnualEntidadView.as_view()),
    path("pdm/ejecucion/<str:codigo_producto>", PdmEjecucionProductoView.as_view()),
    path("bpin/<str:bpin>", BpinDetailView.as_view()),
    path("pdm/contratos/<slug:slug>/upload", PdmContratosUploadView.as_view()),
    path("pdm/contratos/<slug:slug>/contratos", PdmContratosView.as_view()),
]
