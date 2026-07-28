import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Building2, Loader2 } from "lucide-react";
import SessionLoadingScreen from "@/components/ui/SessionLoadingScreen";
import { authApi } from "@/core/auth/api";
import { isPlatformSuperadmin } from "@/core/auth/modules";
import { firstAccessibleRoute, useAuthStore } from "@/core/auth/store";

export default function EntitySelectPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setActiveEntityId = useAuthStore((s) => s.setActiveEntityId);
  const activeEntityId = useAuthStore((s) => s.activeEntityId);
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  if (!isLoaded || (isSignedIn && !user)) {
    return <SessionLoadingScreen />;
  }

  if (!isSignedIn || !user) return <Navigate to="/login" replace />;
  if (isPlatformSuperadmin(user)) return <Navigate to="/superadmin/entities" replace />;

  const memberships = user.memberships ?? [];
  if (memberships.length <= 1 && activeEntityId) {
    return <Navigate to={firstAccessibleRoute(user)} replace />;
  }

  async function choose(entityId: number) {
    setLoadingId(entityId);
    setActiveEntityId(entityId);
    try {
      const profile = await authApi.me();
      setUser(profile);
      navigate(firstAccessibleRoute(profile), { replace: true });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f6f8] px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[#3eafd4] text-lg font-bold text-white">
          S1
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Selecciona una entidad</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tu cuenta tiene acceso a varias entidades. Elige con cuál deseas trabajar.
        </p>
      </div>

      <div className="grid w-full max-w-lg gap-3">
        {memberships.map((m) => (
          <button
            key={m.entity_id}
            type="button"
            disabled={loadingId !== null}
            onClick={() => void choose(m.entity_id)}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#3eafd4] hover:shadow-md disabled:opacity-60"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
              {m.logo_url ? (
                <img src={m.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{m.name}</p>
              <p className="text-xs capitalize text-slate-500">{m.role}</p>
            </div>
            {loadingId === m.entity_id && (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#3eafd4]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
