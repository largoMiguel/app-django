import { Navigate, Outlet } from "react-router-dom";
import { canAccess, type PermissionCode } from "./permissions";
import { useAuthStore } from "./store";

interface Props {
  roles?: string[];
  permissions?: PermissionCode[];
  /** Con permisos: exige todos si true; default cualquiera. */
  permissionsAll?: boolean;
}

export default function RequireRole({ roles = [], permissions = [], permissionsAll = false }: Props) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;

  const ok = canAccess(user, { roles, permissions, permissionsAll });
  if (ok) return <Outlet />;

  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold">403 — Sin acceso</h1>
        <p className="mt-2 text-slate-600">
          Tu rol no tiene permiso para ver esta sección.
        </p>
      </div>
    </div>
  );
}
