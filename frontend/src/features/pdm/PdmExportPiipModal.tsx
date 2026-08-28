import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { pdmApi, type PdmEjecucionMensualMesEstado } from "@/core/api/pdm";
import { formatApiError } from "@/core/api/errors";
import { ANIOS_PDM } from "@/features/pdm/pdmUtils";
import { pdmBtnPrimary, pdmBtnSecondary, pdmSelect } from "@/features/pdm/pdmStyles";
import { PdmAlert, PdmModal } from "@/features/pdm/components/PdmUi";

interface PdmExportPiipModalProps {
  open: boolean;
  slug: string;
  defaultAnio: number;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onSuccess: (detail: string) => void;
  onError: (detail: string) => void;
}

export default function PdmExportPiipModal({
  open,
  slug,
  defaultAnio,
  saving,
  setSaving,
  onClose,
  onSuccess,
  onError,
}: PdmExportPiipModalProps) {
  const [anio, setAnio] = useState(defaultAnio);
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [meses, setMeses] = useState<PdmEjecucionMensualMesEstado[]>([]);
  const [loadingMeses, setLoadingMeses] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnio(defaultAnio);
    setMes(Math.min(new Date().getMonth() + 1, 12));
  }, [open, defaultAnio]);

  useEffect(() => {
    if (!open || !slug) return;
    setLoadingMeses(true);
    void pdmApi
      .listarEjecucionMensual(anio)
      .then((r) => setMeses(r.meses))
      .catch(() => setMeses([]))
      .finally(() => setLoadingMeses(false));
  }, [open, slug, anio]);

  const mesSeleccionado = meses.find((m) => m.mes === mes);
  const sinCargaMensual = mesSeleccionado && !mesSeleccionado.cargado;

  async function handleExport() {
    if (!slug) return;
    setSaving(true);
    try {
      const filename = await pdmApi.exportPiip(slug, anio, mes);
      onSuccess(`Se descargó ${filename}.`);
      onClose();
    } catch (e) {
      onError(formatApiError(e, "No se pudo exportar PIIP."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PdmModal
      open={open}
      title="Exportar PIIP"
      headerTone="success"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={pdmBtnSecondary}>
            Cancelar
          </button>
          <button type="button" disabled={saving} className={pdmBtnPrimary} onClick={() => void handleExport()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar Excel
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        El informe PIIP usa la ejecución mensual cargada para comprometido y pagos, y la ejecución anual para valor
        inicial.
      </p>

      <label className="mt-4 block text-sm font-medium text-slate-700">Año</label>
      <select className={`mt-1 ${pdmSelect}`} value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
        {ANIOS_PDM.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-medium text-slate-700">Mes del informe</label>
      <select
        className={`mt-1 ${pdmSelect}`}
        value={mes}
        onChange={(e) => setMes(Number(e.target.value))}
        disabled={loadingMeses}
      >
        {meses.length > 0
          ? meses.map((m) => (
              <option key={m.mes} value={m.mes}>
                {m.mes_label}
                {!m.cargado ? " (sin ejecución mensual)" : ""}
              </option>
            ))
          : Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Mes {i + 1}
              </option>
            ))}
      </select>

      {sinCargaMensual && (
        <div className="mt-4">
          <PdmAlert tone="info">
          No hay ejecución mensual cargada para {mesSeleccionado.mes_label} {anio}. Comprometido y pago del mes
          saldrán en cero.
          </PdmAlert>
        </div>
      )}
    </PdmModal>
  );
}
