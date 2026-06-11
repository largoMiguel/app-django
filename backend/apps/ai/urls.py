"""URLs de la capa IA."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AIAlertViewSet,
    AIUsageView,
    GlobalCopilotView,
    PdmAnomaliesView,
    PdmCopilotView,
    PdmInsightsView,
    PdmReportView,
    PQRSComplianceView,
    PQRSInsightsView,
    SemanticSearchView,
)

router = DefaultRouter()
router.register("ai/alerts", AIAlertViewSet, basename="ai-alerts")

urlpatterns = [
    path("ai/copilot/pdm/", PdmCopilotView.as_view(), name="ai-copilot-pdm"),
    path("ai/copilot/global/", GlobalCopilotView.as_view(), name="ai-copilot-global"),
    path("ai/pqrs/compliance/", PQRSComplianceView.as_view(), name="ai-pqrs-compliance"),
    path("ai/pqrs/insights/", PQRSInsightsView.as_view(), name="ai-pqrs-insights"),
    path("ai/pdm/<slug>/insights/", PdmInsightsView.as_view(), name="ai-pdm-insights"),
    path("ai/pdm/<slug>/anomalies/", PdmAnomaliesView.as_view(), name="ai-pdm-anomalies"),
    path("ai/pdm/<slug>/report/", PdmReportView.as_view(), name="ai-pdm-report"),
    path("ai/search/", SemanticSearchView.as_view(), name="ai-search"),
    path("ai/usage/", AIUsageView.as_view(), name="ai-usage"),
] + router.urls
