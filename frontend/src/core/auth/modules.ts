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

export function isModuleEnabled(entity: AuthEntity, module: EntityModuleFlag): boolean {
  return Boolean(entity[module]);
}
