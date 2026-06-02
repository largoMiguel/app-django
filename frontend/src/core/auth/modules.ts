import type { AuthEntity } from "./store";

export type EntityModuleFlag =
  | "enable_pqrs"
  | "enable_users_admin"
  | "enable_reports_pdf"
  | "enable_ai_reports"
  | "enable_planes_institucionales"
  | "enable_contratacion"
  | "enable_pdm"
  | "enable_asistencia"
  | "enable_correspondencia"
  | "enable_presupuesto";

export type RequireModuleProps = {
  module: EntityModuleFlag;
};

export const MODULE_FLAG_TO_KEY: Record<EntityModuleFlag, string> = {
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

export function isModuleEnabled(entity: AuthEntity, module: EntityModuleFlag): boolean {
  return Boolean(entity[module]);
}

/** Si el usuario tiene lista de módulos, debe incluir el módulo; lista vacía = todos habilitados. */
export function isUserModuleEnabled(
  user: { enabled_modules?: string[] } | null | undefined,
  module: EntityModuleFlag,
): boolean {
  if (!user) return false;
  const enabled = user.enabled_modules ?? [];
  if (enabled.length === 0) return true;
  return enabled.includes(MODULE_FLAG_TO_KEY[module]);
}
