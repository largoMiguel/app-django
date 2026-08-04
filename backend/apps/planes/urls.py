"""Rutas API — Planes Institucionales."""
from rest_framework.routers import DefaultRouter

from .views import PlanActividadViewSet, PlanCatalogoViewSet, PlanViewSet

router = DefaultRouter()
router.register("planes/catalogo", PlanCatalogoViewSet, basename="planes-catalogo")
router.register("planes/actividades", PlanActividadViewSet, basename="planes-actividades")
router.register("planes", PlanViewSet, basename="planes")

urlpatterns = router.urls
