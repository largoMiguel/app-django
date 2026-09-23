import { lazy, Suspense, useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import ScrollToTop from "@/core/routing/ScrollToTop";
import { isMarketingHost, isShowcaseHost, redirectToApp } from "@/core/host";
import LoginPage from "@/features/auth/LoginPage";
import WelcomePage from "@/features/auth/WelcomePage";
import SinAccesoPage from "@/features/auth/SinAccesoPage";
import SessionLoadingScreen from "@/components/ui/SessionLoadingScreen";
import PqrsLayout from "@/features/pqrs/PqrsLayout";
import PQRSDashboard from "@/features/pqrs/PQRSDashboard";
import PQRSListPage from "@/features/pqrs/PQRSListPage";
import PQRSNuevaPage from "@/features/pqrs/PQRSNuevaPage";
import PQRSDetailPage from "@/features/pqrs/PQRSDetailPage";
import PQRSEditPage from "@/features/pqrs/PQRSEditPage";
import PQRSInformesPage from "@/features/pqrs/PQRSInformesPage";
import UsersPage from "@/features/users/UsersPage";
import SuperAdminEntitiesPage from "@/features/superadmin/EntitiesPage";
import EntityDetailPage from "@/features/superadmin/EntityDetailPage";
import RequireAuth from "@/core/auth/RequireAuth";
import ModuleRouteGuard from "@/core/auth/ModuleRouteGuard";
import RequireSuperadmin from "@/core/auth/RequireSuperadmin";
import AppLayout from "@/components/layout/AppLayout";
import PublicPQRSPortal from "@/features/pqrs/PublicPQRSPortal";
import PublicPdmChatPage from "@/features/pdmchat/PublicPdmChatPage";
import KioskPage from "@/features/kiosk/KioskPage";
import CorreoInstitucionalPage from "@/features/settings/CorreoInstitucionalPage";
import AsistenciaLayout from "@/features/asistencia/AsistenciaLayout";
import AsistenciaDashboard from "@/features/asistencia/AsistenciaDashboard";
import FuncionariosPage from "@/features/asistencia/FuncionariosPage";
import EquiposPage from "@/features/asistencia/EquiposPage";
import RegistrosPage from "@/features/asistencia/RegistrosPage";
import CorrespondenciaLayout from "@/features/correspondencia/CorrespondenciaLayout";
import CorrespondenciaDashboard from "@/features/correspondencia/CorrespondenciaDashboard";
import CorrespondenciaListPage from "@/features/correspondencia/CorrespondenciaListPage";
import CorrespondenciaDetailPage from "@/features/correspondencia/CorrespondenciaDetailPage";
import CorrespondenciaInformesPage from "@/features/correspondencia/CorrespondenciaInformesPage";
import PlanesLayout from "@/features/planes/PlanesLayout";
import PlanesDashboard from "@/features/planes/PlanesDashboard";
import PlanesListPage from "@/features/planes/PlanesListPage";
import PlanDetailPage from "@/features/planes/PlanDetailPage";
import PlanesCronogramaPage from "@/features/planes/PlanesCronogramaPage";
import PlanesInformesPage from "@/features/planes/PlanesInformesPage";
import PlanesInformeTrimestralPage from "@/features/planes/PlanesInformeTrimestralPage";
import PicLayout from "@/features/pic/PicLayout";
import PicDashboard from "@/features/pic/PicDashboard";
import PicActividadesPage from "@/features/pic/PicActividadesPage";
import PicActividadDetailPage from "@/features/pic/PicActividadDetailPage";
import PicEncargadosPage from "@/features/pic/PicEncargadosPage";
import GestionDocumentalLayout from "@/features/gestion-documental/GestionDocumentalLayout";
import GdDashboard from "@/features/gestion-documental/GdDashboard";
import GdInstrumentosPage from "@/features/gestion-documental/GdInstrumentosPage";
import GdClasificacionPage from "@/features/gestion-documental/GdClasificacionPage";
import GdExpedientesPage from "@/features/gestion-documental/GdExpedientesPage";
import GdExpedienteDetailPage from "@/features/gestion-documental/GdExpedienteDetailPage";
import GdInventarioPage from "@/features/gestion-documental/GdInventarioPage";
import GdTransferenciasPage from "@/features/gestion-documental/GdTransferenciasPage";
import GdInformesPage from "@/features/gestion-documental/GdInformesPage";
import SecopLayout from "@/features/secop/SecopLayout";
import SecopResumen from "@/features/secop/SecopResumen";
import SecopListPage from "@/features/secop/SecopListPage";
import SecopIIPage from "@/features/secop/SecopIIPage";
import SecopAlertasPage from "@/features/secop/SecopAlertasPage";
import SecopAnalisisPage from "@/features/secop/SecopAnalisisPage";
import SecopCopilotPage from "@/features/secop/SecopCopilotPage";
import PdmLayout from "@/features/pdm/PdmLayout";
import PdmDashboardPage from "@/features/pdm/PdmDashboardPage";
import PdmProductosPage from "@/features/pdm/PdmProductosPage";
import PdmProductoDetallePage from "@/features/pdm/PdmProductoDetallePage";
import PdmAnalisisPage from "@/features/pdm/PdmAnalisisPage";
import PdmProyectosPage from "@/features/pdm/PdmProyectosPage";
import PdmInformesPage from "@/features/pdm/PdmInformesPage";
import { firstAccessibleRoute, needsEntitySelection, useAuthStore } from "@/core/auth/store";

const HomePage = lazy(() => import("@/features/showcase/HomePage"));
const NosotrosPage = lazy(() => import("@/features/nosotros/NosotrosPage"));
const PrivacidadPage = lazy(() => import("@/features/legal/PrivacidadPage"));
const CondicionesPage = lazy(() => import("@/features/legal/CondicionesPage"));

const suspenseFallback = (
  <div className="flex min-h-screen items-center justify-center text-slate-500">Cargando…</div>
);

/** En softone360.com cualquier ruta de app se manda a app.softone360.com. */
function RedirectToAppHost() {
  const location = useLocation();
  useEffect(() => {
    redirectToApp(`${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);
  return suspenseFallback;
}

/** En app.* no hay showcase: / → login (o bienvenida si ya hay sesión). */
function AppRootEntry() {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const activeEntityId = useAuthStore((s) => s.activeEntityId);

  if (!isLoaded || (isSignedIn && !user)) {
    return <SessionLoadingScreen />;
  }

  if (user) {
    if (needsEntitySelection(user, activeEntityId)) {
      return <Navigate to="/app" replace />;
    }
    return <Navigate to={firstAccessibleRoute(user)} replace />;
  }
  return <Navigate to="/login" replace />;
}

/** Páginas de marketing solo viven en softone360.com. */
function RedirectToMarketingHost() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(`https://softone360.com${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);
  return suspenseFallback;
}

const showcaseHome = (
  <Suspense fallback={suspenseFallback}>
    <HomePage />
  </Suspense>
);

const nosotrosPage = (
  <Suspense fallback={suspenseFallback}>
    <NosotrosPage />
  </Suspense>
);

const privacidadPage = (
  <Suspense fallback={suspenseFallback}>
    <PrivacidadPage />
  </Suspense>
);

const condicionesPage = (
  <Suspense fallback={suspenseFallback}>
    <CondicionesPage />
  </Suspense>
);

const legalMarketingRoutes = (
  <>
    <Route path="/privacidad" element={privacidadPage} />
    <Route path="/condiciones" element={condicionesPage} />
  </>
);

export default function App(): ReactElement {
  const marketing = isMarketingHost();
  const showcase = isShowcaseHost();

  return (
    <>
      <ScrollToTop />
      {marketing ? (
        <Routes>
          <Route path="/" element={showcaseHome} />
          <Route path="/nosotros" element={nosotrosPage} />
          {legalMarketingRoutes}
          <Route path="*" element={<RedirectToAppHost />} />
        </Routes>
      ) : (
        <Routes>
          {showcase ? (
            <>
              <Route path="/" element={showcaseHome} />
              <Route path="/nosotros" element={nosotrosPage} />
              {legalMarketingRoutes}
            </>
          ) : (
            <>
              <Route path="/" element={<AppRootEntry />} />
              <Route path="/nosotros" element={<RedirectToMarketingHost />} />
              <Route path="/privacidad" element={<RedirectToMarketingHost />} />
              <Route path="/condiciones" element={<RedirectToMarketingHost />} />
            </>
          )}
          <Route path="/login/*" element={<LoginPage />} />

          <Route path="/portal/:slug" element={<PublicPQRSPortal />} />
          <Route path="/chat/:slug" element={<PublicPdmChatPage />} />
          <Route path="/kiosk" element={<KioskPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/app" element={<WelcomePage />} />
              <Route path="/sin-acceso" element={<SinAccesoPage />} />
              <Route path="/configuracion/correo" element={<CorreoInstitucionalPage />} />

              <Route element={<ModuleRouteGuard moduleKey="pqrs" />}>
                <Route path="/pqrs" element={<PqrsLayout />}>
                  <Route index element={<PQRSDashboard />} />
                  <Route path="solicitudes" element={<PQRSListPage />} />
                  <Route path="nueva" element={<PQRSNuevaPage />} />
                  <Route element={<ModuleRouteGuard moduleKey="reports_pdf" />}>
                    <Route path="informes" element={<PQRSInformesPage />} />
                  </Route>
                  <Route path=":id/editar" element={<PQRSEditPage />} />
                  <Route path=":id" element={<PQRSDetailPage />} />
                </Route>
                <Route path="/dashboard" element={<Navigate to="/pqrs" replace />} />
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="pdm" />}>
                <Route path="/pdm" element={<PdmLayout />}>
                  <Route index element={<PdmDashboardPage />} />
                  <Route path="productos" element={<PdmProductosPage />} />
                  <Route path="productos/:codigo" element={<PdmProductoDetallePage />} />
                  <Route path="analisis" element={<PdmAnalisisPage />} />
                  <Route path="proyectos" element={<PdmProyectosPage />} />
                  <Route path="informes" element={<PdmInformesPage />} />
                  <Route path="informes/avance" element={<Navigate to="/pdm/informes" replace />} />
                  <Route path="informes/plan-accion" element={<Navigate to="/pdm/informes" replace />} />
                </Route>
              </Route>

              <Route path="/informes" element={<Navigate to="/pqrs/informes" replace />} />

              <Route element={<ModuleRouteGuard moduleKey="asistencia" />}>
                <Route path="/asistencia" element={<AsistenciaLayout />}>
                  <Route index element={<AsistenciaDashboard />} />
                  <Route path="funcionarios" element={<FuncionariosPage />} />
                  <Route path="equipos" element={<EquiposPage />} />
                  <Route path="registros" element={<RegistrosPage />} />
                </Route>
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="correspondencia" />}>
                <Route path="/correspondencia" element={<CorrespondenciaLayout />}>
                  <Route index element={<CorrespondenciaDashboard />} />
                  <Route path="entrada" element={<CorrespondenciaListPage sentido="entrada" />} />
                  <Route path="salida" element={<CorrespondenciaListPage sentido="salida" />} />
                  <Route path="todas" element={<CorrespondenciaListPage />} />
                  <Route path="informes" element={<CorrespondenciaInformesPage />} />
                  <Route path=":id" element={<CorrespondenciaDetailPage />} />
                </Route>
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="planes_institucionales" />}>
                <Route path="/planes" element={<PlanesLayout />}>
                  <Route index element={<PlanesDashboard />} />
                  <Route path="lista" element={<PlanesListPage />} />
                  <Route path="cronograma" element={<PlanesCronogramaPage />} />
                  <Route path="informes" element={<PlanesInformesPage />} />
                  <Route path="informes/seguimiento" element={<Navigate to="/planes/informes" replace />} />
                  <Route path="informes/trimestral" element={<PlanesInformeTrimestralPage />} />
                  <Route path=":id" element={<PlanDetailPage />} />
                </Route>
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="pic" />}>
                <Route path="/pic" element={<PicLayout />}>
                  <Route index element={<PicDashboard />} />
                  <Route path="actividades" element={<PicActividadesPage />} />
                  <Route path="actividades/:id" element={<PicActividadDetailPage />} />
                  <Route path="encargados" element={<PicEncargadosPage />} />
                </Route>
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="gestion_documental" />}>
                <Route path="/gestion-documental" element={<GestionDocumentalLayout />}>
                  <Route index element={<GdDashboard />} />
                  <Route path="instrumentos" element={<GdInstrumentosPage />} />
                  <Route path="clasificacion" element={<GdClasificacionPage />} />
                  <Route path="expedientes" element={<GdExpedientesPage />} />
                  <Route path="expedientes/:id" element={<GdExpedienteDetailPage />} />
                  <Route path="inventario" element={<GdInventarioPage />} />
                  <Route path="transferencias" element={<GdTransferenciasPage />} />
                  <Route path="informes" element={<GdInformesPage />} />
                </Route>
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="contratacion" />}>
                <Route path="/contratacion" element={<SecopLayout />}>
                  <Route index element={<SecopResumen />} />
                  <Route path="secop2" element={<SecopIIPage />} />
                  <Route path="contratos" element={<Navigate to="/contratacion/secop2" replace />} />
                  <Route path="ejecucion" element={<Navigate to="/contratacion/secop2" replace />} />
                  <Route path="dependencias" element={<Navigate to="/contratacion/secop2" replace />} />
                  <Route path="secop1" element={<SecopListPage fuente="secop1" />} />
                  <Route path="alertas" element={<SecopAlertasPage />} />
                  <Route path="ia" element={<SecopAnalisisPage />} />
                  <Route path="copiloto" element={<SecopCopilotPage />} />
                </Route>
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="users_admin" />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>

              <Route element={<RequireSuperadmin />}>
                <Route path="/superadmin/entities" element={<SuperAdminEntitiesPage />} />
                <Route path="/superadmin/entities/:id" element={<EntityDetailPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  );
}
