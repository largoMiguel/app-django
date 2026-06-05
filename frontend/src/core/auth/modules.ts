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

/** Alineado con `is_platform_superadmin` del backend. */
export function isPlatformSuperadmin(
  user: { roles?: string[]; role?: string; is_superuser?: boolean } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  return user.roles?.includes("superadmin") || user.role === "superadmin";
}

export function primaryRole(user: { roles?: string[]; role?: string } | null | undefined): string {
  if (!user) return "";
  if (user.role) return user.role;
  const priority = ["superadmin", "admin", "secretario", "ciudadano"];
  for (const r of priority) {
    if (user.roles?.includes(r)) return r;
  }
  return user.roles?.[0] || "";
}

/** Secretario: lista vacía = ningún módulo (asignación explícita). Admin/otros: vacía = todos los de la entidad. */
export function isUserModuleEnabled(
  user: { enabled_modules?: string[]; roles?: string[]; role?: string } | null | undefined,
  module: EntityModuleFlag,
): boolean {
  if (!user) return false;
  const enabled = user.enabled_modules ?? [];
  const role = primaryRole(user);
  if (role === "secretario") {
    if (enabled.length === 0) return false;
    return enabled.includes(MODULE_FLAG_TO_KEY[module]);
  }
  if (enabled.length === 0) return true;
  return enabled.includes(MODULE_FLAG_TO_KEY[module]);
}
