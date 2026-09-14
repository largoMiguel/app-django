import { useState } from "react";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { formatCOP, secopApi, type SecopRecord } from "@/core/api/secop";
import { MarkdownContent, ProgressBar, SemaforoDot } from "./components";

interface Props {
  record: SecopRecord;
  anio: number;
  onClose: () => void;
}

type Tab = "general" | "pagos" | "modificaciones";

export default function SecopDetalleModal({ record, anio, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const [aiResumen, setAiResumen] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  async function askAi() {
    setLoadingAi(true);
    try {
      const res = await secopApi.aiContrato(record.fuente, record.id, anio);
      setAiResumen(res.resumen);
    } catch {
      setAiResumen("No se pudo generar el resumen con IA.");
    } finally {
      setLoadingAi(false);
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "general", label: "General" },
    { id: "pagos", label: "Pagos", count: record.pagos?.length },
    { id: "modificaciones", label: "Modificaciones", count: record.modificaciones?.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <SemaforoDot semaforo={record.avance?.semaforo || "gris"} />
              <h2 className="text-lg font-semibold text-[#111827]">{record.referencia}</h2>
            </div>
            <p className="text-xs text-slate-500">
              {record.fuente.toUpperCase()} · {record.tipo_registro} · {record.estado}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.id ? "border-[#3eafd4] text-[#0e7490]" : "border-transparent text-slate-500"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-xs">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-5 text-sm">
          {tab === "general" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor" value={formatCOP(record.valor_con_adiciones || record.valor)} />
                <Field
                  label="Pagado"
                  value={record.datos_pago_disponibles ? formatCOP(record.valor_pagado) : "No disponible (SECOP I)"}
                />
                <Field label="Proveedor" value={record.proveedor || "—"} />
                <Field label="Documento" value={record.documento_proveedor || "—"} />
                <Field label="Modalidad" value={record.modalidad || "—"} />
                <Field label="Tipo" value={record.tipo || "—"} />
                <Field label="Fecha firma" value={record.fecha_firma?.slice(0, 10) || "—"} />
                <Field label="Fecha fin" value={record.fecha_fin?.slice(0, 10) || "—"} />
                <Field label="Supervisor" value={record.supervisor || "—"} />
                <Field label="Ordenador" value={record.ordenador_gasto || "—"} />
              </div>

              {record.avance && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ProgressBar value={record.avance.avance_tiempo} label="Avance en tiempo" color="bg-blue-400" />
                  <ProgressBar value={record.avance.avance_financiero} label="Avance financiero" color="bg-emerald-500" />
                </div>
              )}

              <div>
                <span className="text-xs font-bold uppercase text-slate-500">Objeto</span>
                <p className="mt-1 text-slate-700">{record.objeto || "—"}</p>
              </div>

              {record.proceso_vinculado && (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  Proceso vinculado: {record.proceso_vinculado.referencia} — {record.proceso_vinculado.estado}
                </div>
              )}
            </>
          )}

          {tab === "pagos" && (
            <div className="space-y-2">
              {!record.datos_pago_disponibles && (
                <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
                  SECOP I no publica pagos por contrato en datos abiertos.
                </p>
              )}
              {(record.pagos || []).length === 0 ? (
                <p className="text-slate-500">Sin facturas registradas.</p>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-2">Factura</th>
                      <th className="py-2">Fecha</th>
                      <th className="py-2 text-right">Valor</th>
                      <th className="py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.pagos!.map((p, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2">{p.numero_factura || p.radicado || "—"}</td>
                        <td className="py-2">{p.fecha?.slice(0, 10) || "—"}</td>
                        <td className="py-2 text-right">{formatCOP(p.valor_total)}</td>
                        <td className="py-2">{p.estado || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "modificaciones" && (
            <div className="space-y-3">
              {(record.modificaciones || []).length === 0 ? (
                <p className="text-slate-500">Sin modificaciones registradas.</p>
              ) : (
                record.modificaciones!.map((m, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{m.tipo || "Modificación"}</span>
                      <span className="text-xs text-slate-500">{m.fecha_aprobacion || ""}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{m.descripcion || "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      {m.valor_modificacion ? <span>Valor: {formatCOP(m.valor_modificacion)}</span> : null}
                      {m.dias_extendidos ? <span>+{m.dias_extendidos} días</span> : null}
                      {m.liquidacion === "Si" && <span className="text-emerald-600">Liquidado</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {aiResumen && (
            <div className="rounded-lg border border-[#3eafd4]/30 bg-[#3eafd4]/5 p-4">
              <p className="mb-1 text-xs font-bold uppercase text-[#0e7490]">Resumen IA</p>
              <MarkdownContent content={aiResumen} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={askAi}
            disabled={loadingAi}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#3eafd4] px-4 py-2 text-sm text-[#0e7490] hover:bg-[#3eafd4]/10 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {loadingAi ? "Analizando…" : "Resumen con IA"}
          </button>
          {record.url && (
            <a
              href={record.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d9bbf]"
            >
              Ver en SECOP
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <p className="mt-0.5 text-slate-800">{value}</p>
    </div>
  );
}
