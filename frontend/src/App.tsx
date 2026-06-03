import type { ReactElement } from "react";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@/features/auth/LoginPage";
import PQRSDashboard from "@/features/pqrs/PQRSDashboard";
import PQRSPage from "@/features/pqrs/PQRSPage";
import PQRSInformesPage from "@/features/pqrs/PQRSInformesPage";
import UsersPage from "@/features/users/UsersPage";
import SuperAdminEntitiesPage from "@/features/superadmin/EntitiesPage";
import EntityDetailPage from "@/features/superadmin/EntityDetailPage";
import RequireAuth from "@/core/auth/RequireAuth";
import RequireRole from "@/core/auth/RequireRole";
import RequireModule from "@/core/auth/RequireModule";
import AppLayout from "@/components/layout/AppLayout";
import PublicPQRSPortal from "@/features/pqrs/PublicPQRSPortal";
import { PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";
import { PERM, useAuthStore, homeForRole } from "@/core/auth/store";

const PdmPage = lazy(() => import("@/features/pdm/PdmPage"));

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={homeForRole(user)} replace />;
}

export default function App(): ReactElement {
  return (
    <Routes>
      <Route path="/login/*" element={<LoginPage />} />

      {/* Portal ciudadano — público, sin auth */}
      <Route path="/portal/:slug" element={<PublicPQRSPortal />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirect />} />

          {/* PQRS: admin, secretario, ciudadano */}
          <Route
            element={
              <RequireRole
                roles={["admin", "secretario", "ciudadano"]}
                permissions={[PERM.PQRS_VIEW]}
              />
            }
          >
            <Route element={<RequireModule module="enable_pqrs" />}>
              <Route path="/dashboard" element={<PQRSDashboard />} />
              <Route path="/pqrs" element={<PQRSPage />} />
            </Route>
          </Route>

          {/* PDM: admin y secretario */}
          <Route element={<RequireRole roles={["admin", "secretario"]} />}>
            <Route element={<RequireModule module="enable_pdm" />}>
              <Route
                path="/pdm"
                element={
                  <Suspense fallback={<PdmLoadingOverlay message="Cargando PDM..." />}>
                    <PdmPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          {/* Informes: sólo admin */}
          <Route element={<RequireRole roles={["admin"]} permissions={[PERM.PQRS_VIEW]} />}>
            <Route element={<RequireModule module="enable_pqrs" />}>
              <Route element={<RequireModule module="enable_reports_pdf" />}>
                <Route path="/informes" element={<PQRSInformesPage />} />
              </Route>
            </Route>
          </Route>

          {/* Admin de entidad */}
          <Route element={<RequireRole roles={["admin"]} permissions={[PERM.USER_VIEW]} />}>
            <Route element={<RequireModule module="enable_users_admin" />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>

          {/* SuperAdmin */}
          <Route
            element={
              <RequireRole roles={["superadmin"]} permissions={[PERM.ENTITY_VIEW, PERM.ENTITY_CHANGE]} />
            }
          >
            <Route path="/superadmin/entities" element={<SuperAdminEntitiesPage />} />
            <Route path="/superadmin/entities/:id" element={<EntityDetailPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
