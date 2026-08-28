import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { pdmApi, type PdmEjecucionMensualMesEstado } from "@/core/api/pdm";
import { formatApiError } from "@/core/api/errors";
import { ANIOS_PDM } from "@/features/pdm/pdmUtils";
import { pdmBtnPrimary, pdmBtnSecondary, pdmSelect } from "@/features/pdm/pdmStyles";
import { PdmAlert, PdmFilePicker, PdmModal } from "@/features/pdm/components/PdmUi";

interface PdmEjecucionMensualModalProps {
  open: boolean;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onSuccess: (detail: string) => void;
  onError: (detail: string) => void;
}

function formatFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function PdmEjecucionMensualModal({
  open,
  saving,
  setSaving,
  onClose,
  onSuccess,
  onError,
}: PdmEjecucionMensualModalProps) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [meses, setMeses] = useState<PdmEjecucionMensualMesEstado[]>([]);
  const [loading, setLoading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [periodoDetectado, setPeriodoDetectado] = useState<string | null>(null);
  const [confirmarAcumulado, setConfirmarAcumulado] = useState(false);

  const cargarMeses = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pdmApi.listarEjecucionMensual(anio);
      setMeses(r.meses);
    } catch (e) {
      onError(formatApiError(e, "No se pudo cargar el estado mensual."));
    } finally {
      setLoading(false);
    }
  }, [anio, onError]);

  useEffect(() => {
    if (!open) return;
    setArchivo(null);
    setPeriodoDetectado(null);
    setConfirmarAcumulado(false);
    void cargarMeses();
  }, [open, cargarMeses]);

  async function handleUpload() {
    if (!archivo) return;
    setSaving(true);
    try {
      const result = await pdmApi.uploadEjecucionMensual(archivo, confirmarAcumulado);
      setArchivo(null);
      setPeriodoDetectado(null);
      setConfirmarAcumulado(false);
      await cargarMeses();
      let detail = result.message || `Carga mensual ${result.mes}/${result.anio} completada.`;
      if (result.saldo_compromisos_en_cero) {
        detail += " Advertencia: SALDO COMPROMISOS vino en cero en todas las filas.";
      }
      onSuccess(detail);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string; periodo?: { titulo?: string } } } };
      if (err.response?.status === 409 && err.response.data?.periodo) {
        setPeriodoDetectado(err.response.data.periodo.titulo || err.response.data.detail || null);
        onError(err.response.data.detail || "El archivo parece acumulado. Marque confirmar para continuar.");
        return;
      }
      onError(formatApiError(e, "Error al cargar ejecución mensual."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mes: number, label: string) {
    if (!window.confirm(`¿Eliminar la ejecución mensual de ${label} ${anio}?`)) return;
    setSaving(true);
    try {
      await pdmApi.eliminarEjecucionMensual(anio, mes);
      await cargarMeses();
      onSuccess(`Se eliminó la ejecución de ${label} ${anio}.`);
    } catch (e) {
      onError(formatApiError(e, "No se pudo eliminar el mes."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PdmModal
      open={open}
      title="Ejecución mensual (PIIP)"
      headerTone="success"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={pdmBtnSecondary}>
            Cerrar
          </button>
          <button type="button" disabled={!archivo || saving} className={pdmBtnPrimary} onClick={() => void handleUpload()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Subir archivo
          </button>
        </>
      }
    >
      <PdmAlert tone="info">
        Suba el Excel del mes (formato: Del 01/MM/AAAA Al fin de mes). Reemplaza la carga de ese mes. La ejecución
        anual general no se modifica.
      </PdmAlert>

      <label className="mt-4 block text-sm font-medium text-slate-700">Año</label>
      <select className={`mt-1 ${pdmSelect}`} value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
        {ANIOS_PDM.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Mes</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Rango</th>
              <th className="px-3 py-2">Registros</th>
              <th className="px-3 py-2">Subido por</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : (
              meses.map((m) => (
                <tr key={m.mes} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{m.mes_label}</td>
                  <td className="px-3 py-2">
                    <span className={m.cargado ? "text-emerald-700" : "text-slate-400"}>
                      {m.cargado ? "Cargado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {m.cargado ? `${formatFecha(m.rango_desde)} – ${formatFecha(m.rango_hasta)}` : "—"}
                  </td>
                  <td className="px-3 py-2">{m.cargado ? m.registros_insertados : "—"}</td>
                  <td className="px-3 py-2 text-xs">{m.uploaded_by_nombre || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {m.cargado && (
                      <button
                        type="button"
                        disabled={saving}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                        title="Eliminar mes"
                        onClick={() => void handleDelete(m.mes, m.mes_label)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <PdmFilePicker
          accept=".xlsx,.xls,.csv"
          file={archivo}
          onChange={setArchivo}
          emptyLabel="Seleccionar Excel mensual de ejecución"
        />
      </div>

      {periodoDetectado && (
        <div className="mt-3 space-y-2">
          <PdmAlert tone="info">Período detectado: {periodoDetectado}</PdmAlert>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmarAcumulado}
              onChange={(e) => setConfirmarAcumulado(e.target.checked)}
              className="h-4 w-4"
            />
            Confirmar carga de archivo acumulado
          </label>
        </div>
      )}
    </PdmModal>
  );
}
