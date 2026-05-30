import { Navigate, Outlet } from "react-router-dom";
import { canAccess, type PermissionCode } from "./permissions";
import { useAuthStore } from "./store";

interface Props {
  permissions: PermissionCode[];
  /** Si true, requiere todos los permisos; default cualquiera. */
  all?: boolean;
}

export default function RequirePermission({ permissions, all = false }: Props) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;

  const ok = canAccess(user, {
    permissions,
    permissionsAll: all,
  });

  if (ok) return <Outlet />;

  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold">403 — Sin acceso</h1>
        <p className="mt-2 text-slate-600">
          No tienes los permisos necesarios para ver esta sección.
        </p>
      </div>
    </div>
  );
}
