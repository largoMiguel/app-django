import { lazy, Suspense, useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import ScrollToTop from "@/core/routing/ScrollToTop";
import { isMarketingHost, isShowcaseHost, redirectToApp } from "@/core/host";
import LoginPage from "@/features/auth/LoginPage";
import RequireAuth from "@/core/auth/RequireAuth";
import ModuleRouteGuard from "@/core/auth/ModuleRouteGuard";
import RequireSuperadmin from "@/core/auth/RequireSuperadmin";
import AppLayout from "@/components/layout/AppLayout";
import SessionLoadingScreen from "@/components/ui/SessionLoadingScreen";
import { firstAccessibleRoute, needsEntitySelection, useAuthStore } from "@/core/auth/store";

const WelcomePage = lazy(() => import("@/features/auth/WelcomePage"));
const SinAccesoPage = lazy(() => import("@/features/auth/SinAccesoPage"));
const PqrsLayout = lazy(() => import("@/features/pqrs/PqrsLayout"));
const PQRSDashboard = lazy(() => import("@/features/pqrs/PQRSDashboard"));
const PQRSListPage = lazy(() => import("@/features/pqrs/PQRSListPage"));
const PQRSNuevaPage = lazy(() => import("@/features/pqrs/PQRSNuevaPage"));
const PQRSDetailPage = lazy(() => import("@/features/pqrs/PQRSDetailPage"));
const PQRSEditPage = lazy(() => import("@/features/pqrs/PQRSEditPage"));
const PQRSInformesPage = lazy(() => import("@/features/pqrs/PQRSInformesPage"));
const UsersPage = lazy(() => import("@/features/users/UsersPage"));
const SuperAdminEntitiesPage = lazy(() => import("@/features/superadmin/EntitiesPage"));
const EntityDetailPage = lazy(() => import("@/features/superadmin/EntityDetailPage"));
const PublicPQRSPortal = lazy(() => import("@/features/pqrs/PublicPQRSPortal"));
const PublicPdmChatPage = lazy(() => import("@/features/pdmchat/PublicPdmChatPage"));
const KioskPage = lazy(() => import("@/features/kiosk/KioskPage"));
const CorreoInstitucionalPage = lazy(() => import("@/features/settings/CorreoInstitucionalPage"));
const AsistenciaLayout = lazy(() => import("@/features/asistencia/AsistenciaLayout"));
const AsistenciaDashboard = lazy(() => import("@/features/asistencia/AsistenciaDashboard"));
const FuncionariosPage = lazy(() => import("@/features/asistencia/FuncionariosPage"));
const EquiposPage = lazy(() => import("@/features/asistencia/EquiposPage"));
const RegistrosPage = lazy(() => import("@/features/asistencia/RegistrosPage"));
const CorrespondenciaLayout = lazy(() => import("@/features/correspondencia/CorrespondenciaLayout"));
const CorrespondenciaDashboard = lazy(() => import("@/features/correspondencia/CorrespondenciaDashboard"));
const CorrespondenciaListPage = lazy(() => import("@/features/correspondencia/CorrespondenciaListPage"));
const CorrespondenciaDetailPage = lazy(() => import("@/features/correspondencia/CorrespondenciaDetailPage"));
const CorrespondenciaInformesPage = lazy(() => import("@/features/correspondencia/CorrespondenciaInformesPage"));
const PlanesLayout = lazy(() => import("@/features/planes/PlanesLayout"));
const PlanesDashboard = lazy(() => import("@/features/planes/PlanesDashboard"));
const PlanesListPage = lazy(() => import("@/features/planes/PlanesListPage"));
const PlanDetailPage = lazy(() => import("@/features/planes/PlanDetailPage"));
const PlanesCronogramaPage = lazy(() => import("@/features/planes/PlanesCronogramaPage"));
const PlanesInformesPage = lazy(() => import("@/features/planes/PlanesInformesPage"));
const PlanesInformeTrimestralPage = lazy(() => import("@/features/planes/PlanesInformeTrimestralPage"));
const PicLayout = lazy(() => import("@/features/pic/PicLayout"));
const PicDashboard = lazy(() => import("@/features/pic/PicDashboard"));
const PicActividadesPage = lazy(() => import("@/features/pic/PicActividadesPage"));
const PicActividadDetailPage = lazy(() => import("@/features/pic/PicActividadDetailPage"));
const PicEncargadosPage = lazy(() => import("@/features/pic/PicEncargadosPage"));
const GestionDocumentalLayout = lazy(() => import("@/features/gestion-documental/GestionDocumentalLayout"));
const GdDashboard = lazy(() => import("@/features/gestion-documental/GdDashboard"));
const GdInstrumentosPage = lazy(() => import("@/features/gestion-documental/GdInstrumentosPage"));
const GdClasificacionPage = lazy(() => import("@/features/gestion-documental/GdClasificacionPage"));
const GdExpedientesPage = lazy(() => import("@/features/gestion-documental/GdExpedientesPage"));
const GdExpedienteDetailPage = lazy(() => import("@/features/gestion-documental/GdExpedienteDetailPage"));
const GdInventarioPage = lazy(() => import("@/features/gestion-documental/GdInventarioPage"));
const GdTransferenciasPage = lazy(() => import("@/features/gestion-documental/GdTransferenciasPage"));
const GdInformesPage = lazy(() => import("@/features/gestion-documental/GdInformesPage"));
const SecopLayout = lazy(() => import("@/features/secop/SecopLayout"));
const SecopResumen = lazy(() => import("@/features/secop/SecopResumen"));
const SecopListPage = lazy(() => import("@/features/secop/SecopListPage"));
const SecopIIPage = lazy(() => import("@/features/secop/SecopIIPage"));
const SecopAlertasPage = lazy(() => import("@/features/secop/SecopAlertasPage"));
const SecopAnalisisPage = lazy(() => import("@/features/secop/SecopAnalisisPage"));
const SecopCopilotPage = lazy(() => import("@/features/secop/SecopCopilotPage"));
const PdmLayout = lazy(() => import("@/features/pdm/PdmLayout"));
const PdmDashboardPage = lazy(() => import("@/features/pdm/PdmDashboardPage"));
const PdmProductosPage = lazy(() => import("@/features/pdm/PdmProductosPage"));
const PdmProductoDetallePage = lazy(() => import("@/features/pdm/PdmProductoDetallePage"));
const PdmAnalisisPage = lazy(() => import("@/features/pdm/PdmAnalisisPage"));
const PdmProyectosPage = lazy(() => import("@/features/pdm/PdmProyectosPage"));
const PdmInformesPage = lazy(() => import("@/features/pdm/PdmInformesPage"));
const HomePage = lazy(() => import("@/features/showcase/HomePage"));
const NosotrosPage = lazy(() => import("@/features/nosotros/NosotrosPage"));
const PrivacidadPage = lazy(() => import("@/features/legal/PrivacidadPage"));
const CondicionesPage = lazy(() => import("@/features/legal/CondicionesPage"));

const routeFallback = <SessionLoadingScreen />;

const showcaseHome = (
  <Suspense fallback={routeFallback}>
    <HomePage />
  </Suspense>
);

const nosotrosPage = (
  <Suspense fallback={routeFallback}>
    <NosotrosPage />
  </Suspense>
);

const privacidadPage = (
  <Suspense fallback={routeFallback}>
    <PrivacidadPage />
  </Suspense>
);

const condicionesPage = (
  <Suspense fallback={routeFallback}>
    <CondicionesPage />
  </Suspense>
);

/** En softone360.com cualquier ruta de app se manda a app.softone360.com. */
function RedirectToAppHost() {
  const location = useLocation();
  useEffect(() => {
    redirectToApp(`${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);
  return routeFallback;
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
  return routeFallback;
}

const legalMarketingRoutes = (
  <>
    <Route path="/privacidad" element={privacidadPage} />
    <Route path="/condiciones" element={condicionesPage} />
  </>
);

export default function App(): ReactElement {
  const marketing = isMarketingHost();
  const showcase = isShowcaseHost();

  const appRoutes = (
    <Suspense fallback={routeFallback}>
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
    </Suspense>
  );

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
        appRoutes
      )}
    </>
  );
}
