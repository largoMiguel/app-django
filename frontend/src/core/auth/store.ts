import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeAuthUser } from "./permissions";

export { firstAccessibleRoute, canAccessPath, accessibleNavRoutes } from "./routes";

export { primaryRole } from "./modules";

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
  email_firma?: string;
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
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user: user ? normalizeAuthUser(user) : null }),
      logout: () => set({ user: null }),
    }),
    {
      name: "softone.auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

