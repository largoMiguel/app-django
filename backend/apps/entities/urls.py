from rest_framework.routers import DefaultRouter

from .views import EntityViewSet, SecretariaViewSet

router = DefaultRouter()
router.register("entities", EntityViewSet, basename="entity")
router.register("secretarias", SecretariaViewSet, basename="secretaria")

urlpatterns = router.urls
