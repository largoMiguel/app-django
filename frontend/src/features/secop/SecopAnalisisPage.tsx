import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { secopApi, type SecopAnalisisStructured } from "@/core/api/secop";
import { useSecopYear } from "./SecopYearContext";
import { MarkdownContent, SeverityBadge, StatCard } from "./components";

export default function SecopAnalisisPage() {
  const { anio } = useSecopYear();
  const [structured, setStructured] = useState<SecopAnalisisStructured | null>(null);
  const [fallback, setFallback] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAnalisis() {
    setLoading(true);
    try {
      const res = await secopApi.aiAnalisis(anio);
      setStructured(res.structured);
      setFallback(res.analisis);
    } catch {
      setStructured(null);
      setFallback("No se pudo generar el análisis. Verifique SECOP_OPENAI_API_KEY en el servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalisis();
  }, [anio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Generando análisis inteligente…
      </div>
    );
  }

  if (!structured) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-[#3eafd4]" />
            Análisis IA — {anio}
          </h2>
          <button type="button" onClick={loadAnalisis} className="text-sm text-[#0e7490] hover:underline">
            Regenerar
          </button>
        </div>
        <MarkdownContent content={fallback} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
          <Sparkles className="h-5 w-5 text-[#3eafd4]" />
          Análisis IA — vigencia {anio}
        </h2>
        <button
          type="button"
          onClick={loadAnalisis}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-[#0e7490] hover:underline disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerar
        </button>
      </div>

      <div className="rounded-xl border border-[#3eafd4]/20 bg-gradient-to-br from-[#3eafd4]/5 to-white p-6 shadow-sm">
        <p className="text-base leading-relaxed text-slate-800">{structured.resumen_ejecutivo}</p>
      </div>

      {structured.indicadores_clave?.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {structured.indicadores_clave.map((ind, i) => (
            <StatCard
              key={i}
              label={ind.label}
              value={ind.valor}
              sub={ind.detalle}
              icon={<Target className="h-5 w-5" />}
              trend={ind.tendencia === "sube" ? "up" : ind.tendencia === "baja" ? "down" : "stable"}
            />
          ))}
        </div>
      )}

      {structured.hallazgos?.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Hallazgos principales
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {structured.hallazgos.map((h, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{h.titulo}</span>
                  <SeverityBadge severidad={h.severidad} />
                </div>
                <p className="text-sm text-slate-600">{h.detalle}</p>
                {h.metrica && <p className="mt-2 text-xs font-medium text-[#0e7490]">{h.metrica}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {structured.riesgos?.length > 0 && (
        <section className="rounded-xl border border-orange-200 bg-orange-50/30 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-orange-900">
            <AlertTriangle className="h-4 w-4" />
            Riesgos priorizados
          </h3>
          <ul className="space-y-3">
            {structured.riesgos.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-lg bg-white/80 px-4 py-3 shadow-sm">
                <SeverityBadge severidad={r.severidad} />
                <div>
                  <p className="font-medium text-slate-800">{r.titulo}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{r.detalle}</p>
                  {r.impacto && <p className="mt-1 text-xs text-orange-700">Impacto: {r.impacto}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {structured.recomendaciones?.length > 0 && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-emerald-900">Recomendaciones</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {structured.recomendaciones.map((rec, i) => (
              <div key={i} className="rounded-lg border border-emerald-100 bg-white p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{rec.titulo}</span>
                  <SeverityBadge severidad={rec.prioridad} />
                </div>
                <p className="text-sm text-slate-600">{rec.accion}</p>
                {rec.plazo && <p className="mt-2 text-xs text-emerald-700">Plazo sugerido: {rec.plazo}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
