import { useState } from "react";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { formatCOP, secopApi, type SecopRecord } from "@/core/api/secop";

interface Props {
  record: SecopRecord;
  anio: number;
  onClose: () => void;
}

export default function SecopDetalleModal({ record, anio, onClose }: Props) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">{record.referencia}</h2>
            <p className="text-xs text-slate-500">
              {record.fuente.toUpperCase()} · {record.tipo_registro} · {record.estado}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor" value={formatCOP(record.valor)} />
            <Field label="Pagado" value={formatCOP(record.valor_pagado)} />
            <Field label="Proveedor" value={record.proveedor || "—"} />
            <Field label="Documento" value={record.documento_proveedor || "—"} />
            <Field label="Modalidad" value={record.modalidad || "—"} />
            <Field label="Tipo" value={record.tipo || "—"} />
            <Field label="Fecha firma" value={record.fecha_firma?.slice(0, 10) || "—"} />
            <Field label="Fecha fin" value={record.fecha_fin?.slice(0, 10) || "—"} />
            <Field label="Supervisor" value={record.supervisor || "—"} />
          </div>

          <div>
            <span className="text-xs font-bold uppercase text-slate-500">Objeto</span>
            <p className="mt-1 text-slate-700">{record.objeto || "—"}</p>
          </div>

          {record.proceso_vinculado && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              Proceso vinculado: {record.proceso_vinculado.referencia} — {record.proceso_vinculado.estado}
            </div>
          )}

          {aiResumen && (
            <div className="rounded-lg border border-[#3eafd4]/30 bg-[#3eafd4]/5 p-4">
              <p className="mb-1 text-xs font-bold uppercase text-[#0e7490]">Resumen IA</p>
              <p className="whitespace-pre-wrap text-slate-700">{aiResumen}</p>
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
