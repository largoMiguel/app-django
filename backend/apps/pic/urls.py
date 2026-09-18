from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PicActividadViewSet,
    PicCargoViewSet,
    PicEjecucionViewSet,
    PicExportView,
    PicPlanDeleteView,
    PicPlanUploadView,
    PicPlanView,
    PicStatsView,
)

router = DefaultRouter()
router.register("pic/actividades", PicActividadViewSet, basename="pic-actividades")
router.register("pic/ejecuciones", PicEjecucionViewSet, basename="pic-ejecuciones")
router.register("pic/cargos", PicCargoViewSet, basename="pic-cargos")

urlpatterns = [
    path("pic/plan/", PicPlanView.as_view(), name="pic-plan"),
    path("pic/plan/upload/", PicPlanUploadView.as_view(), name="pic-plan-upload"),
    path("pic/plan/<int:anio>/", PicPlanDeleteView.as_view(), name="pic-plan-delete"),
    path("pic/stats/", PicStatsView.as_view(), name="pic-stats"),
    path("pic/export/", PicExportView.as_view(), name="pic-export"),
    path("", include(router.urls)),
]
