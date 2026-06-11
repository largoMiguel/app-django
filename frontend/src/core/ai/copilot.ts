import type { AuthEntity } from "@/core/auth/store";

export const COPILOT_MODULE_KEYS = ["pqrs", "pdm"] as const;
export type CopilotModuleKey = (typeof COPILOT_MODULE_KEYS)[number];

const MODULE_LABELS: Record<CopilotModuleKey, string> = {
  pqrs: "PQRS",
  pdm: "Plan de Desarrollo Municipal",
};

/** Módulos con copiloto IA habilitados para la entidad. */
export function getEntityCopilotModules(
  entity: AuthEntity | null | undefined,
): CopilotModuleKey[] {
  if (!entity) return [];
  const modules: CopilotModuleKey[] = [];
  if (entity.enable_pqrs) modules.push("pqrs");
  if (entity.enable_pdm) modules.push("pdm");
  return modules;
}

export function copilotModulesLabel(modules: CopilotModuleKey[]): string {
  return modules.map((m) => MODULE_LABELS[m]).join(" y ");
}

/** Rutas donde puede mostrarse el copiloto global (no PDM: tiene copiloto propio). */
export function isGlobalCopilotRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/pqrs") ||
    pathname.startsWith("/informes")
  );
}

export function shouldShowGlobalCopilot(
  pathname: string,
  entity: AuthEntity | null | undefined,
): boolean {
  const modules = getEntityCopilotModules(entity);
  if (!modules.includes("pqrs") || !isGlobalCopilotRoute(pathname)) return false;
  return modules.length > 0;
}
