import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeAuthUser } from "./permissions";
import { isPlatformSuperadmin } from "./modules";

export { firstAccessibleRoute, canAccessPath, accessibleNavRoutes } from "./routes";

export { primaryRole } from "./modules";

export function needsEntitySelection(
  user: AuthUser | null,
  activeEntityId: number | null | undefined,
): boolean {
  if (!user || isPlatformSuperadmin(user)) return false;
  const memberships = user.memberships ?? [];
  return memberships.length > 1 && !activeEntityId;
}

export function stripEntityContext(user: AuthUser): AuthUser {
  return {
    ...user,
    entity: null,
    secretaria: null,
    role: "",
    roles: [],
    enabled_modules: [],
    active_entity_id: null,
  };
}

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
  enable_pdm_chat: boolean;
  enable_asistencia: boolean;
  asistencias_por_dia?: number;
  enable_correspondencia: boolean;
  enable_presupuesto: boolean;
  enabled_modules: string[];
}

export interface AuthSecretaria {
  id: number;
  nombre: string;
}

export interface AuthMembership {
  entity_id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
  secretaria_id: number | null;
  secretaria_nombre: string | null;
  is_default: boolean;
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
  email_firma?: string;
  enabled_modules?: string[];
  active_entity_id?: number | null;
  memberships?: AuthMembership[];
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
  user: AuthUser | null;
  activeEntityId: number | null;
  setUser: (u: AuthUser | null) => void;
  setActiveEntityId: (id: number | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeEntityId: null,
      setUser: (user) =>
        set((state) => {
          const next = user ? normalizeAuthUser(user) : null;
          let activeEntityId = state.activeEntityId;
          let profile = next;
          if (next) {
            const memberships = next.memberships ?? [];
            if (memberships.length === 1) {
              activeEntityId = memberships[0].entity_id;
            } else if (memberships.length > 1) {
              const stillValid =
                activeEntityId != null &&
                memberships.some((m) => m.entity_id === activeEntityId);
              if (!stillValid) {
                activeEntityId = null;
              }
              if (!activeEntityId) {
                profile = stripEntityContext(next);
              }
            }
          }
          return { user: profile, activeEntityId: next ? activeEntityId : null };
        }),
      setActiveEntityId: (activeEntityId) => set({ activeEntityId }),
      logout: () => set({ user: null, activeEntityId: null }),
    }),
    {
      name: "softone.auth",
      partialize: (state) => ({
        activeEntityId: state.activeEntityId,
      }),
    },
  ),
);

