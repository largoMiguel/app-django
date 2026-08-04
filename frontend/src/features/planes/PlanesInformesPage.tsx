import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, FileBarChart2, Plus, X } from "lucide-react";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import { PLANES_INFORME_TYPES } from "@/features/planes/informes/planesInformeTypes";
import { btnPrimary } from "./components/PlanesUi";

function TypePickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (route: string) => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#0e7490] px-6 py-4 text-white">
          <span className="text-base font-semibold">Seleccionar tipo de informe</span>
          <button type="button" onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          {PLANES_INFORME_TYPES.filter((t) => t.enabled).map((tipo) => {
            const Icon = tipo.icon;
            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => onSelect(tipo.route)}
                className="flex w-full items-start gap-4 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-[#3eafd4] hover:bg-cyan-50/50"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{tipo.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{tipo.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PlanesInformesPage() {
  const user = useAuthStore((s) => s.user);
  const role = primaryRole(user);
  const canView = role === "admin" || role === "secretario";
  const navigate = useNavigate();
  const [showPicker, setShowPicker] = useState(false);

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        No tienes permiso para ver informes de Planes Institucionales.
      </div>
    );
  }

  function handleTypeSelect(route: string) {
    setShowPicker(false);
    navigate(route);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <FileBarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Informes Planes Institucionales</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Genere informes de seguimiento PDF o exportaciones trimestrales en Excel.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setShowPicker(true)} className={btnPrimary}>
          <Plus className="mr-2 h-4 w-4" />
          Crear informe
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANES_INFORME_TYPES.map((tipo) => {
          const Icon = tipo.icon;
          const card = (
            <div
              className={`flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm transition-colors ${
                tipo.enabled
                  ? "border-slate-200 hover:border-[#3eafd4] hover:shadow-md"
                  : "border-slate-100 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </div>
                {tipo.badge && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    {tipo.badge}
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{tipo.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{tipo.description}</p>
              {tipo.enabled ? (
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0e7490]">
                  Abrir
                  <ChevronRight className="h-4 w-4" />
                </div>
              ) : (
                <p className="mt-4 text-sm font-medium text-slate-400">Disponible próximamente</p>
              )}
            </div>
          );

          if (tipo.enabled) {
            return (
              <Link key={tipo.id} to={tipo.route} className="block h-full">
                {card}
              </Link>
            );
          }

          return (
            <div key={tipo.id} className="h-full cursor-not-allowed" aria-disabled="true">
              {card}
            </div>
          );
        })}
      </div>

      {showPicker && <TypePickerModal onClose={() => setShowPicker(false)} onSelect={handleTypeSelect} />}
    </div>
  );
}
