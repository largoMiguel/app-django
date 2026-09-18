import { useState } from "react";
import { X, Upload } from "lucide-react";
import { picApi } from "@/core/api/pic";
import { formatApiError } from "@/core/api/errors";

interface Props {
  anio: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PicCargaExcelModal({ anio, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [reasignar, setReasignar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof picApi.uploadPlan>> | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Seleccione un archivo Excel.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await picApi.uploadPlan(anio, file, reasignar);
      setResult(res);
      onSuccess();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Cargar Excel PIC — {anio}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <p className="text-sm text-slate-600">
            Sube el archivo <strong>SEGUIMIENTO A PIC.xlsx</strong>. Las actividades existentes se actualizan por número;
            las ejecuciones registradas se conservan.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Archivo (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-[#0e7490] file:px-3 file:py-2 file:text-sm file:text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={reasignar} onChange={(e) => setReasignar(e.target.checked)} />
            Reasignar encargados según mapeo de cargos (sobrescribe asignaciones manuales)
          </label>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
              {error}
            </div>
          )}
          {result && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 space-y-1">
              <p>Carga exitosa: {result.total_actividades} actividades.</p>
              <p>Creadas: {result.creadas} · Actualizadas: {result.actualizadas} · Eliminadas: {result.eliminadas}</p>
              {result.sin_mapeo_encargado.length > 0 && (
                <p>Sin mapeo: {result.sin_mapeo_encargado.join(", ")}</p>
              )}
              {result.advertencias.length > 0 && (
                <ul className="list-disc pl-4 text-amber-800">
                  {result.advertencias.slice(0, 5).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              Cerrar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0e7490] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {loading ? "Cargando…" : "Subir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
