import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isUserModuleEnabled } from "./modules";
import { normalizeAuthUser, canAccess, PERM } from "./permissions";

export type { PermissionCode } from "./permissions";
export {
  PERM,
  canAccess,
  hasAllPermissions,
  hasPermission,
  normalizeAuthUser,
} from "./permissions";

export interface AuthEntity {
  id: number;
  name: string;
  code: string;
  slug: string;
  is_active: boolean;
  logo_url: string | null;
  enable_pqrs: boolean;
  enable_users_admin: boolean;
  enable_reports_pdf: boolean;
  enable_ai_reports: boolean;
  enable_planes_institucionales: boolean;
  enable_contratacion: boolean;
  enable_pdm: boolean;
  enable_asistencia: boolean;
  enable_correspondencia: boolean;
  enable_presupuesto: boolean;
  enabled_modules: string[];
}

export interface AuthSecretaria {
  id: number;
  nombre: string;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  roles: string[];
  permissions: string[];
  is_staff: boolean;
  is_superuser: boolean;
  role?: string;
  entity?: AuthEntity | null;
  secretaria?: AuthSecretaria | null;
  enabled_modules?: string[];
  capabilities?: {
    pqrs?: {
      view?: boolean;
      create?: boolean;
      change?: boolean;
      delete?: boolean;
      assign?: boolean;
      respond?: boolean;
      close?: boolean;
      reopen?: boolean;
    };
    users_admin?: boolean;
    reports_pdf?: boolean;
    ai_reports?: boolean;
  };
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      setUser: (user) => set({ user: user ? normalizeAuthUser(user) : null }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "softone.auth" },
  ),
);

export function hasRole(roles: string[], required: string[]): boolean {
  return required.some((r) => roles.includes(r));
}

export function primaryRole(user: AuthUser | null): string {
  if (!user) return "";
  if (user.role) return user.role;
  const priority = ["superadmin", "admin", "secretario", "ciudadano"];
  for (const r of priority) {
    if (user.roles.includes(r)) return r;
  }
  return user.roles[0] || "";
}

export function homeForRole(user: AuthUser | null): string {
  if (!user) return "/login";
  const role = primaryRole(user);
  if (role === "superadmin") return "/superadmin/entities";
  const entity = user.entity;
  if (!entity) return "/login";

  if (
    entity.enable_pqrs &&
    isUserModuleEnabled(user, "enable_pqrs") &&
    canAccess(user, {
      roles: ["admin", "secretario", "ciudadano"],
      permissions: [PERM.PQRS_VIEW],
    })
  ) {
    return "/dashboard";
  }
  if (
    entity.enable_pdm &&
    isUserModuleEnabled(user, "enable_pdm") &&
    canAccess(user, { roles: ["admin", "secretario"] })
  ) {
    return "/pdm";
  }
  if (
    entity.enable_users_admin &&
    isUserModuleEnabled(user, "enable_users_admin") &&
    canAccess(user, { roles: ["admin"], permissions: [PERM.USER_VIEW] })
  ) {
    return "/users";
  }
  return "/login";
}
