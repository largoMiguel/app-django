import { useEffect, useMemo, useState } from "react";
import { planesApi, TRIMESTRE_OPTIONS, type CronogramaPlan } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesCard, PlanesLoading } from "./components/PlanesUi";
import { usePlanesYear } from "./PlanesYearContext";

function monthIndex(dateStr: string | null, anio: number): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d.getFullYear() !== anio) return null;
  return d.getMonth();
}

function estadoColor(estado: string): string {
  if (estado === "COMPLETADA") return "bg-emerald-500";
  if (estado === "EN_PROGRESO") return "bg-[#3eafd4]";
  if (estado === "CANCELADA") return "bg-slate-400";
  return "bg-amber-400";
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function PlanesCronogramaPage() {
  const { anio } = usePlanesYear();
  const [data, setData] = useState<CronogramaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    planesApi
      .cronograma(anio)
      .then(setData)
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [anio]);

  const trimestreBands = useMemo(
    () => [
      { label: "T I", cols: "1 / span 3" },
      { label: "T II", cols: "4 / span 3" },
      { label: "T III", cols: "7 / span 3" },
      { label: "T IV", cols: "10 / span 3" },
    ],
    [],
  );

  if (loading) return <PlanesLoading message="Cargando cronograma…" />;
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">No hay actividades con fechas para esta vigencia.</p>
      ) : (
        data.map((plan) => (
          <PlanesCard key={plan.plan_id} title={`${plan.catalogo_nombre} (${plan.catalogo_codigo})`}>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[720px] gap-px bg-slate-200"
                style={{ gridTemplateColumns: "200px repeat(12, 1fr)" }}
              >
                <div className="bg-slate-100 p-2 text-xs font-semibold text-slate-600">Actividad</div>
                {MONTHS.map((m) => (
                  <div key={m} className="bg-slate-100 p-2 text-center text-xs font-semibold text-slate-600">
                    {m}
                  </div>
                ))}

                <div className="col-span-full grid bg-slate-50" style={{ gridTemplateColumns: "200px repeat(12, 1fr)" }}>
                  <div className="p-2 text-xs text-slate-400">Trimestres</div>
                  {trimestreBands.map((t) => (
                    <div
                      key={t.label}
                      className="border-x border-slate-200 p-1 text-center text-[10px] font-bold uppercase text-[#0e7490]"
                      style={{ gridColumn: t.cols }}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>

                {plan.actividades.map((act) => (
                  <div key={act.id} className="contents">
                    <div className="bg-white p-2 text-xs text-slate-800">
                      <div className="font-medium">{act.nombre}</div>
                      <div className="text-slate-400">{act.trimestre_label}</div>
                    </div>
                    <div
                      className="relative bg-white p-1"
                      style={{ gridColumn: "2 / -1", display: "grid", gridTemplateColumns: "repeat(12, 1fr)" }}
                    >
                      {(() => {
                        const start = monthIndex(act.fecha_inicio, anio) ?? (act.trimestre - 1) * 3;
                        const end = monthIndex(act.fecha_fin, anio) ?? Math.min(11, start + 2);
                        const colStart = start + 1;
                        const span = Math.max(1, end - start + 1);
                        return (
                          <div
                            className={`mx-0.5 self-center rounded px-1 py-1 text-[10px] text-white ${estadoColor(act.estado)}`}
                            style={{ gridColumn: `${colStart} / span ${span}` }}
                            title={`${act.avance}% · ${act.estado}`}
                          >
                            {act.avance}%
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PlanesCard>
        ))
      )}

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        {TRIMESTRE_OPTIONS.map((t) => (
          <span key={t.value}>{t.label}</span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-emerald-500" /> Completada
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-[#3eafd4]" /> En progreso
        </span>
      </div>
    </div>
  );
}
