from rest_framework.routers import DefaultRouter

from .informe_views import InformePQRSViewSet
from .views import PQRSViewSet

router = DefaultRouter()
router.register("pqrs/informes", InformePQRSViewSet, basename="pqrs-informes")
router.register("pqrs", PQRSViewSet, basename="pqrs")

urlpatterns = router.urls
