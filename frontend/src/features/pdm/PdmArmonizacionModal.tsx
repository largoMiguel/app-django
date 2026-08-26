import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, Loader2, Search, Trash2 } from "lucide-react";
import { pdmApi, type PdmProductoCandidato } from "@/core/api/pdm";
import { formatApiError } from "@/core/api/errors";
import { pdmKeys, useInvalidatePdmQueries } from "@/core/api/hooks/usePdm";
import { formatearMoneda } from "@/features/pdm/pdmUtils";
import { pdmBtnPrimary, pdmBtnSecondary } from "@/features/pdm/pdmStyles";
import { PdmAlert, PdmInput, PdmModal } from "@/features/pdm/components/PdmUi";

const BUSQUEDA_DEBOUNCE_MS = 400;

interface PdmArmonizacionModalProps {
  open: boolean;
  slug: string;
  codigoOrigen?: string;
  ptoDefinitivoOrigen?: number;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function PdmArmonizacionModal({
  open,
  slug,
  codigoOrigen = "",
  ptoDefinitivoOrigen,
  saving,
  setSaving,
  onClose,
  onSuccess,
  onError,
}: PdmArmonizacionModalProps) {
  const invalidatePdm = useInvalidatePdmQueries();
  const [origen, setOrigen] = useState(codigoOrigen);
  const [nota, setNota] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [seleccionado, setSeleccionado] = useState<PdmProductoCandidato | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrigen(codigoOrigen);
    setNota("");
    setBusqueda("");
    setBusquedaDebounced("");
    setSeleccionado(null);
  }, [open, codigoOrigen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBusquedaDebounced(busqueda.trim()), BUSQUEDA_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [busqueda]);

  const { data: armonizaciones = [], isLoading: loadingArmonizaciones, refetch: refetchArmonizaciones } = useQuery({
    queryKey: [...pdmKeys.all, "armonizaciones"],
    queryFn: () => pdmApi.listArmonizaciones(),
    enabled: open,
  });

  const { data: candidatos = [], isLoading: loadingCandidatos } = useQuery({
    queryKey: [...pdmKeys.all, "armonizaciones", "candidatos", busquedaDebounced],
    queryFn: () => pdmApi.candidatosArmonizacion(busquedaDebounced || undefined),
    enabled: open,
  });

  const handleConfirmar = async () => {
    const codigo_origen = origen.trim();
    if (!codigo_origen) {
      onError?.("Indique el código origen del Excel.");
      return;
    }
    if (!seleccionado) {
      onError?.("Seleccione un producto del Plan Indicativo.");
      return;
    }
    setSaving(true);
    try {
      const result = await pdmApi.crearArmonizacion({
        codigo_origen,
        codigo_destino: seleccionado.codigo_producto,
        nota: nota.trim() || undefined,
      });
      invalidatePdm.afterArmonizacion(slug);
      await refetchArmonizaciones();
      onSuccess?.(
        `Armonización aplicada: ${codigo_origen} → ${seleccionado.codigo_producto} (${result.filas_afectadas ?? 0} filas).`,
      );
      onClose();
    } catch (e) {
      onError?.(formatApiError(e, "No se pudo aplicar la armonización."));
    } finally {
      setSaving(false);
    }
  };

  const handleRevertir = async (id: number, codigoOrigenItem: string) => {
    if (!window.confirm(`¿Revertir la armonización del código ${codigoOrigenItem}?`)) return;
    setSaving(true);
    try {
      const result = await pdmApi.eliminarArmonizacion(id);
      invalidatePdm.afterArmonizacion(slug);
      await refetchArmonizaciones();
      onSuccess?.(
        `Armonización revertida para ${result.codigo_origen} (${result.filas_afectadas} filas restauradas).`,
      );
    } catch (e) {
      onError?.(formatApiError(e, "No se pudo revertir la armonización."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PdmModal
      open={open}
      wide
      title="Armonizar ejecución con Plan Indicativo"
      headerTone="cyan"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={pdmBtnSecondary} disabled={saving}>
            Cancelar
          </button>
          <button type="button" onClick={() => void handleConfirmar()} className={pdmBtnPrimary} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Confirmar armonización
          </button>
        </>
      }
    >
      <PdmAlert tone="info">
        Asigne un código de ejecución del Excel a un producto real del Plan Indicativo. La ejecución se sumará ítem por
        ítem al producto destino sin eliminar su ejecución existente.
      </PdmAlert>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código producto (Excel)</label>
          <PdmInput
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            placeholder="Ej. 1906004"
            disabled={Boolean(codigoOrigen)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Pto. definitivo a sumar</label>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
            {ptoDefinitivoOrigen != null ? formatearMoneda(ptoDefinitivoOrigen) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
          <Search size={14} /> Buscar producto del Plan Indicativo
        </label>
        <PdmInput
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Código, indicador, nombre, línea..."
        />
      </div>

      <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
        {loadingCandidatos ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando productos...
          </p>
        ) : candidatos.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No hay productos que coincidan con la búsqueda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {candidatos.map((item) => {
              const active = seleccionado?.clave_producto === item.clave_producto;
              return (
                <li key={item.clave_producto}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left transition ${
                      active ? "bg-cyan-50 ring-1 ring-inset ring-cyan-200" : "hover:bg-slate-50"
                    }`}
                    onClick={() => setSeleccionado(item)}
                  >
                    <p className="font-mono text-sm font-semibold text-slate-900">{item.codigo_producto}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">
                      {item.producto_mga || item.indicador_producto_mga || "Sin nombre"}
                    </p>
                    {item.linea_estrategica ? (
                      <p className="mt-1 text-xs text-slate-500">{item.linea_estrategica}</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {seleccionado ? (
        <PdmAlert tone="success">
          Se sumará la ejecución de <strong>{origen.trim() || "—"}</strong> al producto{" "}
          <strong>{seleccionado.codigo_producto}</strong>
          {ptoDefinitivoOrigen != null ? ` (${formatearMoneda(ptoDefinitivoOrigen)})` : ""}.
        </PdmAlert>
      ) : null}

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-slate-700">Nota (opcional)</label>
        <PdmInput value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Motivo o referencia interna" />
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Armonizaciones vigentes</h3>
        {loadingArmonizaciones ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : armonizaciones.length === 0 ? (
          <p className="text-sm text-slate-500">No hay armonizaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Origen</th>
                  <th className="px-3 py-2">Destino</th>
                  <th className="px-3 py-2 text-right">Pto. definitivo</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {armonizaciones.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-mono">{item.codigo_origen}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono font-semibold">{item.codigo_destino}</span>
                      {item.producto_destino_nombre ? (
                        <p className="line-clamp-1 text-xs text-slate-500">{item.producto_destino_nombre}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">{formatearMoneda(item.pto_definitivo)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        disabled={saving}
                        onClick={() => void handleRevertir(item.id, item.codigo_origen)}
                      >
                        <Trash2 size={12} /> Revertir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PdmModal>
  );
}
