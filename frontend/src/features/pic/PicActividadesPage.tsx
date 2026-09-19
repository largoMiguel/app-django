import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { picApi, type PicActividad } from "@/core/api/pic";
import { formatApiError } from "@/core/api/errors";
import { PicLoading, formatCOP } from "./components/PicUi";
import { usePicYear } from "./PicYearContext";

export default function PicActividadesPage() {
  const navigate = useNavigate();
  const { anio } = usePicYear();
  const [items, setItems] = useState<PicActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [trimestre, setTrimestre] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    picApi
      .listActividades({
        anio,
        page,
        page_size: 20,
        search: search || undefined,
        trimestre: trimestre || undefined,
      })
      .then((data) => {
        setItems(data.results);
        setTotal(data.count);
      })
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [anio, page, search, trimestre]);

  if (loading && items.length === 0) return <PicLoading />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar actividad…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={trimestre}
          onChange={(e) => {
            setTrimestre(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los trimestres</option>
          <option value="1">Trimestre I</option>
          <option value="2">Trimestre II</option>
          <option value="3">Trimestre III</option>
          <option value="4">Trimestre IV</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Actividad</th>
              <th className="px-4 py-3 text-left">Encargado</th>
              <th className="px-4 py-3 text-right">Prog.</th>
              <th className="px-4 py-3 text-right">Ejec.</th>
              <th className="px-4 py-3 text-right">Disp.</th>
              <th className="px-4 py-3 text-right">Valor cobrado</th>
              <th className="px-4 py-3 text-right">Avance</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr
                key={a.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/pic/actividades/${a.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/pic/actividades/${a.id}`);
                  }
                }}
                className="cursor-pointer border-t border-slate-100 hover:bg-[#0e7490]/5 focus:bg-[#0e7490]/5 focus:outline-none"
              >
                <td className="px-4 py-3 font-medium text-[#0e7490]">{a.numero}</td>
                <td className="max-w-xs truncate px-4 py-3" title={a.actividad}>
                  {a.actividad}
                </td>
                <td className="px-4 py-3 text-slate-600">{a.encargado_texto || "—"}</td>
                <td className="px-4 py-3 text-right">{a.total_programado}</td>
                <td className="px-4 py-3 text-right">{a.total_ejecutado}</td>
                <td className="px-4 py-3 text-right">{a.disponible}</td>
                <td className="px-4 py-3 text-right">{formatCOP(a.valor_cobrado_total)}</td>
                <td className="px-4 py-3 text-right">{a.avance_pct}%</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No hay actividades para esta vigencia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="py-1 text-sm text-slate-600">
            Página {page} · {total} actividades
          </span>
          <button
            type="button"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
