import { Link } from "react-router-dom";
import { ChevronRight, FileBarChart2 } from "lucide-react";
import { PDM_INFORME_TYPES } from "@/features/pdm/informes/pdmInformeTypes";
import { usePdm } from "@/features/pdm/PdmContext";

export default function PdmInformesPage() {
  const { isAdmin, isSecretario } = usePdm();
  const canView = isAdmin || isSecretario;

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        No tienes permiso para ver informes PDM.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
          <FileBarChart2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Informes PDM</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Seleccione el tipo de informe que desea generar o consultar en el historial.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PDM_INFORME_TYPES.map((tipo) => {
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
    </div>
  );
}
