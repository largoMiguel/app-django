import { lazy, Suspense, useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import ScrollToTop from "@/core/routing/ScrollToTop";
import { isMarketingHost, isShowcaseHost, redirectToApp } from "@/core/host";
import LoginPage from "@/features/auth/LoginPage";
import SinAccesoPage from "@/features/auth/SinAccesoPage";
import SessionLoadingScreen from "@/components/ui/SessionLoadingScreen";
import PQRSDashboard from "@/features/pqrs/PQRSDashboard";
import PQRSPage from "@/features/pqrs/PQRSPage";
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
import SecopLayout from "@/features/secop/SecopLayout";
import SecopResumen from "@/features/secop/SecopResumen";
import SecopListPage from "@/features/secop/SecopListPage";
import SecopAlertasPage from "@/features/secop/SecopAlertasPage";
import SecopAnalisisIAPage from "@/features/secop/SecopAnalisisIAPage";
import PdmLayout from "@/features/pdm/PdmLayout";
import PdmDashboardPage from "@/features/pdm/PdmDashboardPage";
import PdmProductosPage from "@/features/pdm/PdmProductosPage";
import PdmProductoDetallePage from "@/features/pdm/PdmProductoDetallePage";
import PdmAnalisisPage from "@/features/pdm/PdmAnalisisPage";
import PdmProyectosPage from "@/features/pdm/PdmProyectosPage";
import PdmInformesPage from "@/features/pdm/PdmInformesPage";
import PdmInformePlanAccionPage from "@/features/pdm/PdmInformePlanAccionPage";
import { firstAccessibleRoute, needsEntitySelection, useAuthStore } from "@/core/auth/store";

const HomePage = lazy(() => import("@/features/showcase/HomePage"));
const NosotrosPage = lazy(() => import("@/features/nosotros/NosotrosPage"));

const suspenseFallback = (
  <div className="flex min-h-screen items-center justify-center text-slate-500">Cargando…</div>
);

function AppHomeRedirect() {
  const user = useAuthStore((s) => s.user);
  const activeEntityId = useAuthStore((s) => s.activeEntityId);
  if (needsEntitySelection(user, activeEntityId)) {
    return <SessionLoadingScreen message="Seleccione una entidad…" />;
  }
  return <Navigate to={firstAccessibleRoute(user)} replace />;
}

/** En softone360.com cualquier ruta de app se manda a app.softone360.com. */
function RedirectToAppHost() {
  const location = useLocation();
  useEffect(() => {
    redirectToApp(`${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);
  return suspenseFallback;
}

/** En app.* no hay showcase: / → login (o dashboard si ya hay sesión). */
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
          <Route path="*" element={<RedirectToAppHost />} />
        </Routes>
      ) : (
        <Routes>
          {showcase ? (
            <>
              <Route path="/" element={showcaseHome} />
              <Route path="/nosotros" element={nosotrosPage} />
            </>
          ) : (
            <>
              <Route path="/" element={<AppRootEntry />} />
              <Route path="/nosotros" element={<RedirectToMarketingHost />} />
            </>
          )}
          <Route path="/login/*" element={<LoginPage />} />

          <Route path="/portal/:slug" element={<PublicPQRSPortal />} />
          <Route path="/chat/:slug" element={<PublicPdmChatPage />} />
          <Route path="/kiosk" element={<KioskPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/app" element={<AppHomeRedirect />} />
              <Route path="/sin-acceso" element={<SinAccesoPage />} />

              <Route element={<ModuleRouteGuard moduleKey="pqrs" />}>
                <Route path="/dashboard" element={<PQRSDashboard />} />
                <Route path="/pqrs" element={<PQRSPage />} />
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
                  <Route path="informes/plan-accion" element={<PdmInformePlanAccionPage />} />
                </Route>
              </Route>

              <Route element={<ModuleRouteGuard moduleKey="reports_pdf" />}>
                <Route path="/informes" element={<PQRSInformesPage />} />
              </Route>

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

              <Route element={<ModuleRouteGuard moduleKey="contratacion" />}>
                <Route path="/contratacion" element={<SecopLayout />}>
                  <Route index element={<SecopResumen />} />
                  <Route path="secop2" element={<SecopListPage fuente="secop2" />} />
                  <Route path="secop1" element={<SecopListPage fuente="secop1" />} />
                  <Route path="alertas" element={<SecopAlertasPage />} />
                  <Route path="ia" element={<SecopAnalisisIAPage />} />
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
