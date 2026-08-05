import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { formatCOP, secopApi, SEVERIDAD_COLORS, type SecopAlert } from "@/core/api/secop";
import { useSecopYear } from "./SecopYearContext";
import { SeverityBadge } from "./components";

export default function SecopAlertasPage() {
  const { anio } = useSecopYear();
  const [alertas, setAlertas] = useState<SecopAlert[]>([]);
  const [resumen, setResumen] = useState<Record<string, number>>({});
  const [severidad, setSeveridad] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number> = { anio };
    if (severidad) params.severidad = severidad;
    secopApi
      .alertas(params)
      .then((res) => {
        setAlertas(res.alertas);
        setResumen(res.resumen);
      })
      .finally(() => setLoading(false));
  }, [anio, severidad]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Alertas de contratación</h2>
          <p className="text-sm text-slate-500">Riesgos detectados automáticamente en SECOP I y II</p>
        </div>
        <div className="flex gap-2">
          <select
            value={severidad}
            onChange={(e) => setSeveridad(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas las severidades</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          <button
            type="button"
            onClick={() => secopApi.exportExcel("alertas", anio)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["critica", "alta", "media", "baja"] as const).map((s) => (
          <div key={s} className={`rounded-xl border px-4 py-3 ${SEVERIDAD_COLORS[s]}`}>
            <div className="text-2xl font-bold">{resumen[s] ?? 0}</div>
            <div className="text-xs font-semibold uppercase">{s}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Analizando alertas…</div>
      ) : alertas.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center text-emerald-800">
          No se detectaron alertas para los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-3">
          {alertas.map((a) => (
            <details key={a.codigo} className="group rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
                <SeverityBadge severidad={a.severidad} />
                <span className="flex-1 font-semibold text-slate-800">{a.titulo}</span>
                <span className="text-xs text-slate-500">{a.cantidad} caso(s)</span>
                {a.valor_implicado > 0 && (
                  <span className="text-sm font-medium text-slate-700">{formatCOP(a.valor_implicado)}</span>
                )}
              </summary>
              <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
                <p className="mb-3">{a.mensaje}</p>
                {a.registros.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {a.registros.map((r) => (
                      <li key={r.id} className="rounded bg-slate-50 px-2 py-1">
                        <strong>{r.referencia}</strong> — {r.proveedor || "Sin proveedor"} — {formatCOP(r.valor || 0)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
