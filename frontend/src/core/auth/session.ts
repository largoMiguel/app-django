import { queryClient } from "@/core/queryClient";
import { useAuthStore } from "@/core/auth/store";

export function clearClientSession(): void {
  // Clear React Query cache to avoid cross-user data bleed.
  queryClient.clear();

  // Reset auth store in memory/persisted state.
  useAuthStore.getState().logout();

  // Remove user-scoped persisted reports/cache fragments.
  const keysToDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("softone_pqrs_reports_")) keysToDelete.push(key);
  }
  for (const key of keysToDelete) localStorage.removeItem(key);
}

