import { Loader2, X } from "lucide-react";
import type { ProyectoBpin } from "@/core/api/bpin";
import { formatearMoneda } from "@/features/pdm/pdmUtils";
import { pdmBtnSecondary, pdmCard } from "@/features/pdm/pdmLayout";

interface PdmBpinModalProps {
  open: boolean;
  cargando: boolean;
  proyecto: ProyectoBpin | null;
  error: string | null;
  consultaUrl: string | null;
  portalUrl: string | null;
  onClose: () => void;
}

export default function PdmBpinModal({
  open,
  cargando,
  proyecto,
  error,
  consultaUrl,
  portalUrl,
  onClose,
}: PdmBpinModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="bpin-modal-title"
      >
        <div className="flex items-center justify-between bg-cyan-600 px-4 py-3 text-white sm:px-5">
          <h2 id="bpin-modal-title" className="text-base font-semibold sm:text-lg">
            Información del Proyecto BPIN
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[0.3rem] p-1.5 hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
              <p className="mt-4 text-sm">Consultando datos del proyecto en datos.gov.co...</p>
            </div>
          ) : !proyecto ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p>{error || "No se encontró información para este código BPIN en datos.gov.co"}</p>
              {consultaUrl && (
                <p className="mt-3 text-slate-600">
                  URL de consulta API:{" "}
                  <a href={consultaUrl} target="_blank" rel="noreferrer" className="text-cyan-700 underline break-all">
                    {consultaUrl}
                  </a>
                </p>
              )}
              {portalUrl && (
                <p className="mt-2 text-slate-600">
                  Portal datos.gov.co:{" "}
                  <a href={portalUrl} target="_blank" rel="noreferrer" className="text-cyan-700 underline">
                    Ver dataset BPIN
                  </a>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Código BPIN</p>
                <p className="mt-1 text-xl font-bold text-blue-700">{proyecto.bpin}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre del Proyecto</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{proyecto.nombreproyecto || "N/D"}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objetivo General</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                  {proyecto.objetivogeneral || "N/D"}
                </p>
              </div>

              <div className={`${pdmCard} p-4 sm:p-5`}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</p>
                    <span className="mt-1 inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-800">
                      {proyecto.estadoproyecto || "N/D"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Horizonte</p>
                    <p className="mt-1 text-sm text-slate-800">{proyecto.horizonte || "N/D"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sector</p>
                    <p className="mt-1 text-sm text-slate-800">{proyecto.sector || "N/D"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entidad Responsable</p>
                    <p className="mt-1 text-sm text-slate-800">{proyecto.entidadresponsable || "N/D"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor Total</p>
                    <p className="mt-1 text-lg font-bold text-emerald-700">
                      {formatearMoneda(Number(proyecto.valortotalproyecto || 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor Vigente</p>
                    <p className="mt-1 text-lg font-bold text-cyan-700">
                      {formatearMoneda(Number(proyecto.valorvigenteproyecto || 0))}
                    </p>
                  </div>
                </div>
              </div>

              {(consultaUrl || portalUrl) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {consultaUrl && (
                    <p>
                      Fuente API:{" "}
                      <a href={consultaUrl} target="_blank" rel="noreferrer" className="text-cyan-700 underline break-all">
                        datos.gov.co
                      </a>
                    </p>
                  )}
                  {portalUrl && (
                    <p className={consultaUrl ? "mt-2" : ""}>
                      Portal:{" "}
                      <a href={portalUrl} target="_blank" rel="noreferrer" className="text-cyan-700 underline">
                        Ver dataset BPIN
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} className={pdmBtnSecondary}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
