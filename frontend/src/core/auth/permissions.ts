import type { AuthUser } from "./store";

/** Permisos Django (app_label.codename) usados en la UI. */
export const PERM = {
  PQRS_VIEW: "pqrs.view_pqrs",
  PQRS_ADD: "pqrs.add_pqrs",
  PQRS_CHANGE: "pqrs.change_pqrs",
  PQRS_DELETE: "pqrs.delete_pqrs",
  USER_VIEW: "accounts.view_user",
  USER_ADD: "accounts.add_user",
  USER_CHANGE: "accounts.change_user",
  USER_DELETE: "accounts.delete_user",
  ENTITY_VIEW: "entities.view_entity",
  ENTITY_CHANGE: "entities.change_entity",
} as const;

export type PermissionCode = (typeof PERM)[keyof typeof PERM] | string;

export function normalizeAuthUser(user: AuthUser): AuthUser {
  return {
    ...user,
    roles: user.roles ?? (user.role ? [user.role] : []),
    permissions: user.permissions ?? [],
  };
}

export function hasPermission(user: AuthUser | null, ...required: PermissionCode[]): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (!required.length) return true;
  const granted = new Set(user.permissions ?? []);
  return required.some((p) => granted.has(p));
}

export function hasAllPermissions(user: AuthUser | null, ...required: PermissionCode[]): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (!required.length) return true;
  const granted = new Set(user.permissions ?? []);
  return required.every((p) => granted.has(p));
}

export interface AccessOptions {
  roles?: string[];
  permissions?: PermissionCode[];
  /** Si true, exige todos los permisos listados; default any. */
  permissionsAll?: boolean;
}

/**
 * Acceso si cumple rol explícito O permiso Django (RBAC fino).
 * Mantiene compatibilidad con roles del sistema y roles custom con permisos.
 */
export function canAccess(user: AuthUser | null, opts: AccessOptions): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;

  const { roles = [], permissions = [], permissionsAll = false } = opts;

  if (roles.length) {
    const roleMatch =
      roles.some((r) => user.roles.includes(r)) || (user.role ? roles.includes(user.role) : false);
    if (roleMatch) return true;
  }

  if (permissions.length) {
    return permissionsAll
      ? hasAllPermissions(user, ...permissions)
      : hasPermission(user, ...permissions);
  }

  return roles.length === 0;
}
