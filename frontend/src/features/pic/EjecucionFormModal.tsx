import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { picApi } from "@/core/api/pic";
import { formatApiError } from "@/core/api/errors";
import { formatCOP } from "./components/PicUi";

interface Props {
  actividadId: number;
  anio: number;
  disponible: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EjecucionFormModal({ actividadId, anio, disponible, onClose, onSuccess }: Props) {
  const [fecha, setFecha] = useState(`${anio}-01-15`);
  const [cantidad, setCantidad] = useState(1);
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState<FileList | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof picApi.previewValor>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cantidad < 1) return;
    picApi.previewValor(actividadId, cantidad).then(setPreview).catch(() => setPreview(null));
  }, [actividadId, cantidad]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!archivos?.length) {
      setError("Adjunte al menos un PDF de evidencia.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await picApi.createEjecucion(
        actividadId,
        { fecha_ejecucion: fecha, cantidad_ejecutada: cantidad, descripcion },
        Array.from(archivos),
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Registrar ejecución</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha de ejecución</label>
            <input
              type="date"
              value={fecha}
              min={`${anio}-01-01`}
              max={`${anio}-12-31`}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Cantidad ejecutada</label>
            <input
              type="number"
              min={1}
              max={disponible}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Disponible: {disponible}</p>
          </div>
          {preview && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                preview.valido ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {preview.valido ? (
                <>Valor a cobrar: <strong>{formatCOP(preview.valor_cobrado ?? 0)}</strong></>
              ) : (
                preview.mensaje
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Evidencia PDF (máx. 5)</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => setArchivos(e.target.files)}
              required
              className="block w-full text-sm"
            />
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (preview !== null && !preview.valido)}
              className="rounded-lg bg-[#0e7490] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
