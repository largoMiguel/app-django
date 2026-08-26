import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { pdmApi } from "@/core/api/pdm";
import { formatApiError } from "@/core/api/errors";
import { usePdm } from "@/features/pdm/PdmContext";
import { ANIOS_PDM } from "@/features/pdm/pdmUtils";
import { PdmCard } from "@/features/pdm/components/PdmUi";
import { pdmBtnPrimary, pdmBtnSecondary, pdmSelect } from "@/features/pdm/pdmStyles";

export default function PdmInformePlanAccionPage() {
  const { slug, isAdmin, filtroAnio, entityId } = usePdm();
  const [anio, setAnio] = useState(filtroAnio);
  const [secretariaId, setSecretariaId] = useState<number | "">("");
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAnio(filtroAnio);
  }, [filtroAnio]);

  useEffect(() => {
    if (!isAdmin || !entityId) return;
    secretariasApi.list(entityId).then(setSecretarias).catch(() => setSecretarias([]));
  }, [isAdmin, entityId]);

  async function handleDownload() {
    if (!slug) return;
    setDownloading(true);
    setError(null);
    const params: Record<string, string> = { anio: String(anio) };
    if (isAdmin && secretariaId) {
      params.responsable_secretaria = String(secretariaId);
    }
    const depSuffix = secretariaId ? `_dep${secretariaId}` : "";
    const filename = `Plan_Accion_PDM_${slug}_${anio}${depSuffix}.xlsx`;
    try {
      await pdmApi.downloadPlanAccion(slug, params, filename);
    } catch (err) {
      setError(formatApiError(err, "No se pudo generar el Excel del plan de acción."));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/pdm/informes" className={pdmBtnSecondary}>
        <ArrowLeft className="h-4 w-4" /> Volver a informes
      </Link>
      <PdmCard title="Plan de Acción (Excel)">
        <p className="mb-4 text-sm text-slate-600">
          Exporte el plan de acción del PDM por vigencia y dependencia: actividades con metas y responsables,
          resumen por producto/meta y consolidado por secretaría. La descarga es inmediata y no se guarda historial
          en el servidor.
        </p>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Vigencia</label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className={pdmSelect}
            >
              {ANIOS_PDM.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Dependencia (opcional)</label>
              <select
                value={secretariaId}
                onChange={(e) => setSecretariaId(e.target.value ? Number(e.target.value) : "")}
                className={pdmSelect}
              >
                <option value="">Toda la entidad</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-6">
          <button type="button" onClick={() => void handleDownload()} disabled={downloading} className={pdmBtnPrimary}>
            <Download className="h-4 w-4" />
            {downloading ? "Generando…" : "Descargar plan de acción Excel"}
          </button>
        </div>
      </PdmCard>
    </div>
  );
}
