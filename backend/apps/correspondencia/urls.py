from rest_framework.routers import DefaultRouter

from .views import CorrespondenciaViewSet

router = DefaultRouter()
router.register("correspondencia", CorrespondenciaViewSet, basename="correspondencia")

urlpatterns = router.urls
