import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { authApi } from "@/core/auth/api";
import { needsEntitySelection, useAuthStore } from "@/core/auth/store";
import { queryClient } from "@/core/queryClient";

/**
 * Modal bloqueante al iniciar sesión cuando hay varias membresías.
 * Para cambiar de entidad el usuario debe cerrar sesión y volver a ingresar.
 */
export default function EntitySelectModal() {
  const user = useAuthStore((s) => s.user);
  const activeEntityId = useAuthStore((s) => s.activeEntityId);
  const setUser = useAuthStore((s) => s.setUser);
  const setActiveEntityId = useAuthStore((s) => s.setActiveEntityId);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  if (!user || !needsEntitySelection(user, activeEntityId)) return null;

  async function choose(entityId: number) {
    setLoadingId(entityId);
    setActiveEntityId(entityId);
    queryClient.clear();
    try {
      const profile = await authApi.me();
      setUser(profile);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-select-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#3eafd4] text-sm font-bold text-white">
            S1
          </div>
          <h2 id="entity-select-title" className="text-lg font-bold text-slate-900">
            ¿Con qué entidad desea iniciar?
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Su cuenta tiene acceso a varias entidades. Elija una para continuar.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Para cambiar de entidad, cierre sesión e ingrese de nuevo.
          </p>
        </div>

        <div className="space-y-2">
          {(user.memberships ?? []).map((m) => (
            <button
              key={m.entity_id}
              type="button"
              disabled={loadingId !== null}
              onClick={() => void choose(m.entity_id)}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[#3eafd4] hover:bg-[#f0fbff] disabled:opacity-60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                {m.logo_url ? (
                  <img src={m.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-5 w-5 text-slate-400" />
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
    </div>
  );
}
