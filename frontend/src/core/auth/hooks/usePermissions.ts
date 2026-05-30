import { useMemo } from "react";
import {
  canAccess,
  hasAllPermissions,
  hasPermission,
  type AccessOptions,
  type PermissionCode,
} from "../permissions";
import { useAuthStore } from "../store";

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  return useMemo(
    () => ({
      user,
      permissions: user?.permissions ?? [],
      has: (...perms: PermissionCode[]) => hasPermission(user, ...perms),
      hasAll: (...perms: PermissionCode[]) => hasAllPermissions(user, ...perms),
      can: (opts: AccessOptions) => canAccess(user, opts),
    }),
    [user],
  );
}
