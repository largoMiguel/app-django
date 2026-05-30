from rest_framework.routers import DefaultRouter

from .user_views import UserViewSet

router = DefaultRouter()
router.register("", UserViewSet, basename="user-admin")

urlpatterns = router.urls
