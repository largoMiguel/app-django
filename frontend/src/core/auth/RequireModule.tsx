import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "./store";
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

  if (!isModuleEnabled(entity, module)) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Módulo no disponible</h1>
          <p className="mt-2 text-slate-500">
            Este módulo no está habilitado para tu entidad. Contacta a tu administrador.
          </p>
        </div>
      </div>
    );
  }

  if (!isUserModuleEnabled(user, module)) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Acceso restringido</h1>
          <p className="mt-2 text-slate-500">
            Tu usuario no tiene habilitado este módulo. Contacta a tu administrador.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
