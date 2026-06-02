import { Navigate, Outlet } from "react-router-dom";
import { homeForRole, useAuthStore } from "./store";
import { isModuleEnabled, isUserModuleEnabled, type EntityModuleFlag } from "./modules";

interface Props {
  module: EntityModuleFlag;
}

function isSuperadminUser(user: { roles: string[]; role?: string }) {
  return user.roles.includes("superadmin") || user.role === "superadmin";
}

export default function RequireModule({ module }: Props) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;

  const entity = user.entity;
  if (!entity) {
    if (isSuperadminUser(user)) {
      return <Navigate to="/superadmin/entities" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (!isModuleEnabled(entity, module) || !isUserModuleEnabled(user, module)) {
    return <Navigate to={homeForRole(user)} replace />;
  }

  return <Outlet />;
}
