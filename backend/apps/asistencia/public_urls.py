from django.urls import path

from .public_views import KioskPairView, KioskRegistroView, KioskSessionView

urlpatterns = [
    path("asistencia/kiosk/pair", KioskPairView.as_view()),
    path("asistencia/kiosk/session", KioskSessionView.as_view()),
    path("asistencia/kiosk/registros", KioskRegistroView.as_view()),
]
