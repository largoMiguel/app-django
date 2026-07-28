import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { isPlatformSuperadmin } from "./modules";
import { useAuthStore } from "./store";

export default function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const activeEntityId = useAuthStore((s) => s.activeEntityId);
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Cargando…
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const memberships = user.memberships ?? [];
  if (
    !isPlatformSuperadmin(user) &&
    memberships.length > 1 &&
    !activeEntityId &&
    location.pathname !== "/seleccionar-entidad"
  ) {
    return <Navigate to="/seleccionar-entidad" replace />;
  }

  return <Outlet />;
}
