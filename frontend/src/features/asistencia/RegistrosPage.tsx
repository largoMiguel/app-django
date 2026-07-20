import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { asistenciaApi, type RegistroAsistencia } from "@/core/api/asistencia";
import { formatApiError } from "@/core/api/errors";
import { getClerkToken } from "@/core/auth/clerkToken";

export default function RegistrosPage() {
  const [items, setItems] = useState<RegistroAsistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page_size: "50" };
      if (search.trim()) params.search = search.trim();
      if (fechaDesde) params.fecha_desde = `${fechaDesde}T00:00:00`;
      if (fechaHasta) params.fecha_hasta = `${fechaHasta}T23:59:59`;
      const res = await asistenciaApi.registros.list(params);
      setItems(res.results);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, fechaDesde, fechaHasta]);

  async function exportExcel() {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (fechaDesde) params.fecha_desde = `${fechaDesde}T00:00:00`;
      if (fechaHasta) params.fecha_hasta = `${fechaHasta}T23:59:59`;
      const url = asistenciaApi.registros.exportUrl(params);
      const token = await getClerkToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "asistencia.xlsx";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar funcionario…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm"
          />
        </div>
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <Download className="h-4 w-4" /> {exporting ? "Exportando…" : "Excel"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Fecha / hora</th>
              <th className="whitespace-nowrap px-4 py-3">Funcionario</th>
              <th className="whitespace-nowrap px-4 py-3">Tipo</th>
              <th className="whitespace-nowrap px-4 py-3">Equipo</th>
              <th className="whitespace-nowrap px-4 py-3">Foto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Sin registros.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                    {new Date(r.fecha_hora).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-slate-800">{r.funcionario_nombre}</span>
                    <span className="ml-2 text-xs text-slate-500">{r.funcionario_cedula}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-full bg-[#e8f6fa] px-2.5 py-0.5 text-xs font-medium text-[#0d6e8a]">
                      {r.tipo_label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.equipo_nombre}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.foto_url ? (
                      <a
                        href={r.foto_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[#3eafd4] hover:underline focus:outline-none focus-visible:underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
