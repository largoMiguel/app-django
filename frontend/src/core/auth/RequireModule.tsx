import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "./store";
import { isModuleEnabled, type EntityModuleFlag } from "./modules";

interface Props {
  module: EntityModuleFlag;
}

const MODULE_FLAG_TO_KEY: Record<EntityModuleFlag, string> = {
  enable_pqrs: "pqrs",
  enable_users_admin: "users_admin",
  enable_reports_pdf: "reports_pdf",
  enable_ai_reports: "ai_reports",
  enable_planes_institucionales: "planes_institucionales",
  enable_contratacion: "contratacion",
  enable_pdm: "pdm",
  enable_asistencia: "asistencia",
  enable_correspondencia: "correspondencia",
  enable_presupuesto: "presupuesto",
};

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

  const enabledForUser = user.enabled_modules ?? [];
  const moduleKey = MODULE_FLAG_TO_KEY[module];
  if (enabledForUser.length > 0 && !enabledForUser.includes(moduleKey)) {
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
