// Definición central de módulos y mapeo con flags de Entity.
import type { Entity } from "@/core/api/entities";

export interface ModuleDef {
  key: string;
  label: string;
  flag: keyof Entity;
  /** Si el módulo se ofrece para asignar a secretarios. */
  scope: "all" | "admin_only";
}

export const MODULES: ModuleDef[] = [
  { key: "pqrs", label: "PQRS", flag: "enable_pqrs", scope: "all" },
  { key: "users_admin", label: "Administración de usuarios", flag: "enable_users_admin", scope: "admin_only" },
  { key: "reports_pdf", label: "Reportes PDF", flag: "enable_reports_pdf", scope: "all" },
  { key: "ai_reports", label: "Reportes con IA", flag: "enable_ai_reports", scope: "all" },
  { key: "planes_institucionales", label: "Planes institucionales", flag: "enable_planes_institucionales", scope: "all" },
  { key: "contratacion", label: "Contratación", flag: "enable_contratacion", scope: "all" },
  { key: "pdm", label: "Plan de Desarrollo Municipal", flag: "enable_pdm", scope: "all" },
  { key: "asistencia", label: "Asistencia", flag: "enable_asistencia", scope: "all" },
  { key: "correspondencia", label: "Correspondencia", flag: "enable_correspondencia", scope: "all" },
  { key: "presupuesto", label: "Presupuesto", flag: "enable_presupuesto", scope: "all" },
];

export function modulesForEntity(entity: Entity | null | undefined): ModuleDef[] {
  if (!entity) return [];
  return MODULES.filter((m) => Boolean(entity[m.flag]));
}
