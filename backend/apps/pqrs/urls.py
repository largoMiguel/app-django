from rest_framework.routers import DefaultRouter

from .views import PQRSViewSet

router = DefaultRouter()
router.register("pqrs", PQRSViewSet, basename="pqrs")

urlpatterns = router.urls
