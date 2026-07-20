import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { asistenciaApi, type RegistroDiario } from "@/core/api/asistencia";
import { formatApiError } from "@/core/api/errors";
import { getClerkToken } from "@/core/auth/clerkToken";
import { useAuthStore } from "@/core/auth/store";

function PunchCell({ slot }: { slot?: RegistroDiario["entrada"] }) {
  if (!slot) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-mono text-slate-800">{slot.hora.slice(0, 5)}</span>
      {slot.foto_url && (
        <a
          href={slot.foto_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-[#3eafd4] hover:underline focus:outline-none focus-visible:underline"
        >
          Ver
        </a>
      )}
    </span>
  );
}

export default function RegistrosPage() {
  const punchesPerDay = useAuthStore((s) => s.user?.entity?.asistencias_por_dia ?? 2);
  const [items, setItems] = useState<RegistroDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const showFour = punchesPerDay === 4;

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page_size: "50" };
      if (search.trim()) params.search = search.trim();
      if (fechaDesde) params.fecha_desde = `${fechaDesde}T00:00:00`;
      if (fechaHasta) params.fecha_hasta = `${fechaHasta}T23:59:59`;
      const res = await asistenciaApi.registros.diario(params);
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
      const params: Record<string, string> = { diario: "1" };
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
      a.download = "asistencia_diaria.xlsx";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  const colSpan = showFour ? 8 : 6;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar funcionario…"
            className="w-full rounded-[0.3rem] border border-slate-300 py-2 pl-10 pr-3 text-sm"
          />
        </div>
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
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-[0.3rem] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <Download className="h-4 w-4" /> {exporting ? "Exportando…" : "Excel"}
        </button>
      </div>

      {error && (
        <div className="rounded-[0.3rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Fecha</th>
              <th className="whitespace-nowrap px-4 py-3">Funcionario</th>
              <th className="whitespace-nowrap px-4 py-3">Entrada</th>
              {showFour && (
                <>
                  <th className="whitespace-nowrap px-4 py-3">Salida alm.</th>
                  <th className="whitespace-nowrap px-4 py-3">Retorno</th>
                </>
              )}
              <th className="whitespace-nowrap px-4 py-3">Salida</th>
              <th className="whitespace-nowrap px-4 py-3">Equipo</th>
              <th className="whitespace-nowrap px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
                  Sin registros.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={`${r.fecha}-${r.funcionario_id}`} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                    {new Date(`${r.fecha}T12:00:00`).toLocaleDateString("es-CO")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-slate-800">{r.funcionario_nombre}</span>
                    <span className="ml-2 text-xs text-slate-500">{r.funcionario_cedula}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PunchCell slot={r.entrada} />
                  </td>
                  {showFour && (
                    <>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PunchCell slot={r.salida_almuerzo} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PunchCell slot={r.retorno_almuerzo} />
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3">
                    <PunchCell slot={r.salida} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.equipo_nombre || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.estado === "completa"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.estado === "solo_entrada"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.estado_label}
                    </span>
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
