import { Navigate, Outlet } from "react-router-dom";
import { firstAccessibleRoute } from "./routes";
import { isPlatformSuperadmin } from "./modules";
import { useAuthStore } from "./store";

export default function RequireSuperadmin() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;

  if (!isPlatformSuperadmin(user)) {
    return <Navigate to={firstAccessibleRoute(user)} replace />;
  }

  return <Outlet />;
}
