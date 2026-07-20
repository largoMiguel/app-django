import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { correspondenciaApi } from "@/core/api/correspondencia";
import { getClerkToken } from "@/core/auth/clerkToken";
import { formatApiError } from "@/core/api/errors";

export default function CorrespondenciaInformesPage() {
  const [sentido, setSentido] = useState("");
  const [estado, setEstado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function params(): Record<string, string> {
    const p: Record<string, string> = {};
    if (sentido) p.sentido = sentido;
    if (estado) p.estado = estado;
    if (fechaDesde) p.fecha_desde = `${fechaDesde}T00:00:00`;
    if (fechaHasta) p.fecha_hasta = `${fechaHasta}T23:59:59`;
    return p;
  }

  async function download(format: "xlsx" | "pdf") {
    setBusy(true);
    setError(null);
    try {
      const url = correspondenciaApi.exportUrl({ ...params(), format });
      const token = await getClerkToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = format === "pdf" ? "correspondencia.pdf" : "correspondencia.xlsx";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-l-4 border-l-[#3eafd4] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#111827]">Exportar listado filtrado</h2>
        <p className="mt-1 text-sm text-slate-500">
          Genera Excel o PDF con los radicados según los filtros seleccionados.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={sentido}
            onChange={(e) => setSentido(e.target.value)}
            className="rounded-[0.3rem] border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos los sentidos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-[0.3rem] border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="radicada">Radicada</option>
            <option value="en_tramite">En trámite</option>
            <option value="respondida">Respondida</option>
            <option value="cerrada">Cerrada</option>
          </select>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="rounded-[0.3rem] border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="rounded-[0.3rem] border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => download("xlsx")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={() => download("pdf")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[0.3rem] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[0.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
