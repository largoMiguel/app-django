import { lazy, Suspense, useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ScrollToTop from "@/core/routing/ScrollToTop";
import { isMarketingHost, redirectToApp } from "@/core/host";
import LoginPage from "@/features/auth/LoginPage";
import SinAccesoPage from "@/features/auth/SinAccesoPage";
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
import { PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";
import { firstAccessibleRoute, useAuthStore } from "@/core/auth/store";

const HomePage = lazy(() => import("@/features/showcase/HomePage"));
const NosotrosPage = lazy(() => import("@/features/nosotros/NosotrosPage"));
const PdmPage = lazy(() => import("@/features/pdm/PdmPage"));

const suspenseFallback = (
  <div className="flex min-h-screen items-center justify-center text-slate-500">Cargando…</div>
);

function AppHomeRedirect() {
  const user = useAuthStore((s) => s.user);
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
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to={firstAccessibleRoute(user)} replace />;
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

export default function App(): ReactElement {
  const marketing = isMarketingHost();

  return (
    <>
      <ScrollToTop />
      {marketing ? (
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={suspenseFallback}>
                <HomePage />
              </Suspense>
            }
          />
          <Route
            path="/nosotros"
            element={
              <Suspense fallback={suspenseFallback}>
                <NosotrosPage />
              </Suspense>
            }
          />
          <Route path="*" element={<RedirectToAppHost />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<AppRootEntry />} />
          <Route path="/nosotros" element={<RedirectToMarketingHost />} />
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
                <Route
                  path="/pdm"
                  element={
                    <Suspense fallback={<PdmLoadingOverlay message="Cargando PDM..." />}>
                      <PdmPage />
                    </Suspense>
                  }
                />
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
