import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { planesApi, TRIMESTRE_OPTIONS, type PlanListItem } from "@/core/api/planes";
import { formatApiError } from "@/core/api/errors";
import { PlanesCard, btnPrimary, inputClass } from "./components/PlanesUi";
import { usePlanesYear } from "./PlanesYearContext";

export default function PlanesInformeTrimestralPage() {
  const { anio } = usePlanesYear();
  const [trimestre, setTrimestre] = useState<number | "">("");
  const [planId, setPlanId] = useState<number | "">("");
  const [secretariaId, setSecretariaId] = useState<number | "">("");
  const [planes, setPlanes] = useState<PlanListItem[]>([]);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    planesApi.list({ anio: String(anio), page_size: "100" }).then((r) => setPlanes(r.results)).catch(() => setPlanes([]));
    secretariasApi.list().then(setSecretarias).catch(() => setSecretarias([]));
  }, [anio]);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    const params: Record<string, string> = { anio: String(anio) };
    if (trimestre) params.trimestre = String(trimestre);
    if (planId) params.plan = String(planId);
    if (secretariaId) params.responsable_secretaria = String(secretariaId);
    const triSuffix = trimestre ? `_T${trimestre}` : "";
    const filename = `Planes_D612_${anio}${triSuffix}.xlsx`;
    try {
      await planesApi.downloadExport(params, filename);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <PlanesCard title="Informe trimestral (Excel)">
      <p className="mb-4 text-sm text-slate-600">
        Exporte el seguimiento de actividades y evidencias por vigencia y trimestre, conforme al Decreto 612 de 2018.
        La descarga es inmediata y no se guarda historial en el servidor.
      </p>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Trimestre</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
          >
            <option value="">Todos</option>
            {TRIMESTRE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Plan</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
          >
            <option value="">Todos</option>
            {planes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Secretaría</label>
          <select
            value={secretariaId}
            onChange={(e) => setSecretariaId(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
          >
            <option value="">Todas</option>
            {secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-6">
        <button type="button" onClick={handleDownload} disabled={downloading} className={btnPrimary}>
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "Generando…" : "Descargar informe Excel"}
        </button>
      </div>
    </PlanesCard>
  );
}
