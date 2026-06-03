import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { useAuthStore } from "./store";

export default function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Cargando…
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Cargando perfil…
      </div>
    );
  }

  return <Outlet />;
}
