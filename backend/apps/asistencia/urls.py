from django.urls import path

from .views import (
    AsistenciaStatsView,
    EquipoDetailView,
    EquipoListCreateView,
    EquipoPairingView,
    EquipoRevokeView,
    FuncionarioDetailView,
    FuncionarioFaceEnrollView,
    FuncionarioListCreateView,
    RegistroDiarioListView,
    RegistroExportView,
    RegistroListView,
)

urlpatterns = [
    path("asistencia/funcionarios", FuncionarioListCreateView.as_view()),
    path("asistencia/funcionarios/<int:pk>", FuncionarioDetailView.as_view()),
    path("asistencia/funcionarios/<int:pk>/rostro", FuncionarioFaceEnrollView.as_view()),
    path("asistencia/equipos", EquipoListCreateView.as_view()),
    path("asistencia/equipos/<int:pk>", EquipoDetailView.as_view()),
    path("asistencia/equipos/<int:pk>/pairing", EquipoPairingView.as_view()),
    path("asistencia/equipos/<int:pk>/revoke", EquipoRevokeView.as_view()),
    path("asistencia/registros/diario", RegistroDiarioListView.as_view()),
    path("asistencia/registros/export", RegistroExportView.as_view()),
    path("asistencia/registros", RegistroListView.as_view()),
    path("asistencia/stats", AsistenciaStatsView.as_view()),
]
