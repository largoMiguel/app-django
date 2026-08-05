from django.urls import path

from .views import (
    Secop1AnaliticaView,
    Secop1ListView,
    Secop2AnaliticaView,
    Secop2ListView,
    SecopAIAnalisisView,
    SecopAICopilotView,
    SecopAIContratoView,
    SecopAlertasView,
    SecopConfigView,
    SecopDetalleView,
    SecopExportView,
    SecopRefrescarView,
    SecopResumenView,
)

urlpatterns = [
    path("secop/config/", SecopConfigView.as_view(), name="secop-config"),
    path("secop/resumen/", SecopResumenView.as_view(), name="secop-resumen"),
    path("secop/secop2/", Secop2ListView.as_view(), name="secop2-list"),
    path("secop/secop2/analitica/", Secop2AnaliticaView.as_view(), name="secop2-analitica"),
    path("secop/secop1/", Secop1ListView.as_view(), name="secop1-list"),
    path("secop/secop1/analitica/", Secop1AnaliticaView.as_view(), name="secop1-analitica"),
    path("secop/alertas/", SecopAlertasView.as_view(), name="secop-alertas"),
    path("secop/detalle/", SecopDetalleView.as_view(), name="secop-detalle"),
    path("secop/export/", SecopExportView.as_view(), name="secop-export"),
    path("secop/refrescar/", SecopRefrescarView.as_view(), name="secop-refrescar"),
    path("secop/ai/analisis/", SecopAIAnalisisView.as_view(), name="secop-ai-analisis"),
    path("secop/ai/copilot/", SecopAICopilotView.as_view(), name="secop-ai-copilot"),
    path("secop/ai/contrato/", SecopAIContratoView.as_view(), name="secop-ai-contrato"),
]
