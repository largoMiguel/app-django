import { lazy, Suspense, type ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
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
import { PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";
import { firstAccessibleRoute, useAuthStore } from "@/core/auth/store";

const HomePage = lazy(() => import("@/features/showcase/HomePage"));
const NosotrosPage = lazy(() => import("@/features/nosotros/NosotrosPage"));
const PdmPage = lazy(() => import("@/features/pdm/PdmPage"));

function AppHomeRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={firstAccessibleRoute(user)} replace />;
}

export default function App(): ReactElement {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando…</div>}>
            <HomePage />
          </Suspense>
        }
      />
      <Route
        path="/nosotros"
        element={
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando…</div>}>
            <NosotrosPage />
          </Suspense>
        }
      />
      <Route path="/login/*" element={<LoginPage />} />

      {/* Portal ciudadano — público, sin auth */}
      <Route path="/portal/:slug" element={<PublicPQRSPortal />} />

      {/* Chat IA del PDM — público, sin auth */}
      <Route path="/chat/:slug" element={<PublicPdmChatPage />} />

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
  );
}
