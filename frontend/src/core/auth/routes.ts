import { MODULES } from "@/core/modules";
import {
  isModuleEnabled,
  isPlatformSuperadmin,
  isUserModuleEnabled,
  primaryRole,
  type EntityModuleFlag,
} from "./modules";
import { canAccess, PERM, type AccessOptions } from "./permissions";
import type { AuthUser } from "./store";

export type AppModuleKey =
  | "pqrs"
  | "pdm"
  | "planes_institucionales"
  | "users_admin"
  | "reports_pdf"
  | "asistencia"
  | "correspondencia"
  | "contratacion";

export interface AppModuleRoute {
  moduleKey: AppModuleKey;
  path: string;
  paths?: string[];
  label: string;
  module: EntityModuleFlag;
  alsoRequires?: EntityModuleFlag[];
  access: AccessOptions;
  showInNav?: boolean;
  /** Usuarios va al final del menú lateral. */
  navSection?: "main" | "secondary";
}

/** Configuración única: rutas, guards, sidebar y redirección post-login. */
export const APP_MODULE_ROUTES: AppModuleRoute[] = [
  {
    moduleKey: "pqrs",
    path: "/dashboard",
    paths: ["/dashboard", "/pqrs"],
    label: "PQRS",
    module: "enable_pqrs",
    access: {
      roles: ["admin", "secretario", "contratista", "ciudadano"],
      permissions: [PERM.PQRS_VIEW],
    },
    showInNav: true,
    navSection: "main",
  },
  {
    moduleKey: "pdm",
    path: "/pdm",
    paths: ["/pdm"],
    label: "PDM",
    module: "enable_pdm",
    access: { roles: ["admin", "secretario", "contratista"] },
    showInNav: true,
    navSection: "main",
  },
  {
    moduleKey: "planes_institucionales",
    path: "/planes",
    paths: ["/planes"],
    label: "Planes Institucionales",
    module: "enable_planes_institucionales",
    access: { roles: ["admin", "secretario", "contratista"] },
    showInNav: true,
    navSection: "main",
  },
  {
    moduleKey: "asistencia",
    path: "/asistencia",
    paths: ["/asistencia"],
    label: "Asistencia",
    module: "enable_asistencia",
    access: { roles: ["admin", "secretario"] },
    showInNav: true,
    navSection: "main",
  },
  {
    moduleKey: "correspondencia",
    path: "/correspondencia",
    paths: ["/correspondencia"],
    label: "Correspondencia",
    module: "enable_correspondencia",
    access: { roles: ["admin", "secretario", "contratista"] },
    showInNav: true,
    navSection: "main",
  },
  {
    moduleKey: "contratacion",
    path: "/contratacion",
    paths: ["/contratacion"],
    label: "Contratación",
    module: "enable_contratacion",
    access: { roles: ["admin", "secretario"] },
    showInNav: true,
    navSection: "main",
  },
  {
    moduleKey: "users_admin",
    path: "/users",
    label: "Usuarios",
    module: "enable_users_admin",
    access: { roles: ["admin", "secretario"], permissions: [PERM.USER_VIEW] },
    showInNav: true,
    navSection: "secondary",
  },
  {
    moduleKey: "reports_pdf",
    path: "/informes",
    label: "Informes",
    module: "enable_reports_pdf",
    alsoRequires: ["enable_pqrs"],
    access: { roles: ["admin"], permissions: [PERM.PQRS_VIEW] },
    showInNav: false,
  },
];

const ROUTE_BY_MODULE_KEY = Object.fromEntries(
  APP_MODULE_ROUTES.map((route) => [route.moduleKey, route]),
) as Record<AppModuleKey, AppModuleRoute>;

const PATH_RULES = APP_MODULE_ROUTES.flatMap((entry) =>
  (entry.paths ?? [entry.path]).map((prefix) => ({ prefix, entry })),
);

export function getModuleRoute(moduleKey: AppModuleKey): AppModuleRoute {
  return ROUTE_BY_MODULE_KEY[moduleKey];
}

function modulesInOrder(user: AuthUser): string[] {
  const entity = user.entity;
  if (!entity) return [];

  const orderedKeys = MODULES.map((m) => m.key);
  const userEnabled = user.enabled_modules ?? [];
  const entityEnabled = entity.enabled_modules ?? [];
  const role = primaryRole(user);

  if (role === "secretario") {
    if (userEnabled.length === 0) return [];
    const allowed = new Set(userEnabled);
    if (isModuleEnabled(entity, "enable_users_admin")) {
      allowed.add("users_admin");
    }
    return orderedKeys.filter((key) => allowed.has(key));
  }

  if (role === "contratista") {
    if (userEnabled.length === 0) return [];
    const allowed = new Set(userEnabled);
    return orderedKeys.filter((key) => allowed.has(key));
  }

  if (userEnabled.length > 0) {
    const allowed = new Set(userEnabled);
    return orderedKeys.filter((key) => allowed.has(key));
  }

  if (entityEnabled.length > 0) {
    const allowed = new Set(entityEnabled);
    return orderedKeys.filter((key) => allowed.has(key));
  }

  return MODULES.filter((m) => isModuleEnabled(entity, m.flag as EntityModuleFlag)).map(
    (m) => m.key,
  );
}

export function canAccessModuleRoute(user: AuthUser | null, moduleKey: AppModuleKey): boolean {
  if (!user) return false;
  const entry = ROUTE_BY_MODULE_KEY[moduleKey];
  if (!entry) return false;

  const entity = user.entity;
  if (!entity) return false;

  const modules = [entry.module, ...(entry.alsoRequires ?? [])];
  const role = primaryRole(user);
  for (const mod of modules) {
    if (entry.moduleKey === "users_admin" && role === "secretario") {
      continue;
    }
    if (!isModuleEnabled(entity, mod) || !isUserModuleEnabled(user, mod)) {
      return false;
    }
  }

  return canAccess(user, entry.access);
}

/** Primera ruta del primer módulo activo al que el usuario tiene acceso. */
export function firstAccessibleRoute(user: AuthUser | null): string {
  if (!user) return "/app";
  if (isPlatformSuperadmin(user)) return "/superadmin/entities";

  const entity = user.entity;
  if (!entity) return "/app";

  for (const moduleKey of modulesInOrder(user)) {
    const key = moduleKey as AppModuleKey;
    if (!ROUTE_BY_MODULE_KEY[key]) continue;
    if (canAccessModuleRoute(user, key)) return ROUTE_BY_MODULE_KEY[key].path;
  }

  return "/sin-acceso";
}

/** Indica si el usuario puede visitar una ruta (p. ej. destino tras login). */
export function canAccessPath(user: AuthUser | null, pathname: string): boolean {
  if (!user) return false;

  if (pathname.startsWith("/superadmin")) {
    return isPlatformSuperadmin(user);
  }

  const rule = PATH_RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  if (!rule) return pathname === "/" || pathname === "/sin-acceso";

  return canAccessModuleRoute(user, rule.entry.moduleKey);
}

export interface NavRouteItem {
  moduleKey: AppModuleKey | "superadmin";
  path: string;
  label: string;
  matchPaths: string[];
  navSection: "main" | "secondary";
}

export function accessibleNavRoutes(user: AuthUser | null): NavRouteItem[] {
  if (!user) return [];

  if (isPlatformSuperadmin(user)) {
    return [
      {
        moduleKey: "superadmin",
        path: "/superadmin/entities",
        label: "Entidades",
        matchPaths: ["/superadmin/entities"],
        navSection: "main",
      },
    ];
  }

  const routes = APP_MODULE_ROUTES.filter(
    (route) => route.showInNav && canAccessModuleRoute(user, route.moduleKey),
  ).map((route) => ({
    moduleKey: route.moduleKey,
    path: route.path,
    label: route.label,
    matchPaths: route.paths ?? [route.path],
    navSection: route.navSection ?? "main",
  }));

  const byLabel = (a: NavRouteItem, b: NavRouteItem) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" });

  const main = routes.filter((r) => r.navSection === "main").sort(byLabel);
  const secondary = routes.filter((r) => r.navSection === "secondary").sort(byLabel);
  return [...main, ...secondary];
}
