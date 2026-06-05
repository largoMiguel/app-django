import { Navigate, Outlet } from "react-router-dom";
import { canAccessModuleRoute, firstAccessibleRoute, type AppModuleKey } from "./routes";
import { isPlatformSuperadmin } from "./modules";
import { useAuthStore } from "./store";

interface Props {
  moduleKey: AppModuleKey;
}

export default function ModuleRouteGuard({ moduleKey }: Props) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;

  const entity = user.entity;
  if (!entity) {
    if (isPlatformSuperadmin(user)) {
      return <Navigate to="/superadmin/entities" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (!canAccessModuleRoute(user, moduleKey)) {
    return <Navigate to={firstAccessibleRoute(user)} replace />;
  }

  return <Outlet />;
}
