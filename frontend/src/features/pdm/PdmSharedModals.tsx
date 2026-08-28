import { Upload } from "lucide-react";
import { pdmApi } from "@/core/api/pdm";
import { formatApiError } from "@/core/api/errors";
import { useInvalidatePdmQueries } from "@/core/api/hooks/usePdm";
import PdmActividadModal from "@/features/pdm/PdmActividadModal";
import PdmArmonizacionModal from "@/features/pdm/PdmArmonizacionModal";
import PdmBpinModal from "@/features/pdm/PdmBpinModal";
import { usePdm } from "@/features/pdm/PdmContext";
import { ANIOS_PDM } from "@/features/pdm/pdmUtils";
import { pdmBtnPrimary, pdmBtnSecondary, pdmSelect } from "@/features/pdm/pdmStyles";
import { PdmAlert, PdmFilePicker, PdmModal } from "@/features/pdm/components/PdmUi";

export default function PdmSharedModals() {
  const pdm = usePdm();
  const invalidatePdm = useInvalidatePdmQueries();

  const {
    slug,
    route,
    saving,
    setSaving,
    setError,
    setUploadFeedback,
    fileInputRef,
    handleExcelSelected,
    modalContratos,
    setModalContratos,
    modalEjecucion,
    setModalEjecucion,
    modalArmonizacion,
    setModalArmonizacion,
    armonizacionCodigoOrigen,
    armonizacionPtoDefinitivo,
    anioContratos,
    setAnioContratos,
    anioEjecucion,
    setAnioEjecucion,
    archivoContratos,
    setArchivoContratos,
    archivoEjecucion,
    setArchivoEjecucion,
    productoSeleccionado,
    mostrarModalActividad,
    setMostrarModalActividad,
    actividadEnEdicion,
    setActividadEnEdicion,
    guardandoEvidencia,
    anioDetalle,
    secretarias,
    contratistas,
    canDelegateContratista,
    secretariaUsuarioId,
    isSecretario,
    guardarActividad,
    mostrarModalBpin,
    cargandoBpin,
    proyectoBpin,
    errorBpin,
    consultaUrlBpin,
    portalUrlBpin,
    cerrarModalBpin,
  } = pdm;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => void handleExcelSelected(e.target.files?.[0] || null)}
      />

      <PdmModal
        open={modalEjecucion}
        title="Cargar ejecución presupuestal"
        headerTone="success"
        onClose={() => setModalEjecucion(false)}
        footer={
          <>
            <button type="button" onClick={() => setModalEjecucion(false)} className={pdmBtnSecondary}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!archivoEjecucion || saving}
              className={pdmBtnPrimary}
              onClick={() =>
                void (async () => {
                  if (!archivoEjecucion) return;
                  setSaving(true);
                  try {
                    const result = await pdmApi.uploadEjecucion(archivoEjecucion, anioEjecucion);
                    invalidatePdm.afterUploadEjecucion(slug);
                    setModalEjecucion(false);
                    setArchivoEjecucion(null);
                    setError(null);
                    setUploadFeedback({
                      tone: "success",
                      title: "Ejecución presupuestal cargada",
                      detail:
                        result.message ||
                        `${result.registros_insertados ?? 0} registros insertados, ${result.registros_eliminados ?? 0} eliminados del año ${anioEjecucion}.`,
                    });
                  } catch (e) {
                    const detail = formatApiError(e, "Error al cargar.");
                    setError(detail);
                    setUploadFeedback({
                      tone: "error",
                      title: "Error al cargar ejecución presupuestal",
                      detail,
                    });
                  } finally {
                    setSaving(false);
                  }
                })()
              }
            >
              <Upload className="h-4 w-4" /> Cargar
            </button>
          </>
        }
      >
        <PdmAlert tone="info">Reemplaza todos los datos de ejecución del año seleccionado.</PdmAlert>
        <label className="mt-4 block text-sm font-medium text-slate-700">Año</label>
        <select className={`mt-1 ${pdmSelect}`} value={anioEjecucion} onChange={(e) => setAnioEjecucion(Number(e.target.value))}>
          {ANIOS_PDM.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <PdmFilePicker
          accept=".xlsx,.xls,.csv"
          file={archivoEjecucion}
          onChange={setArchivoEjecucion}
          emptyLabel="Seleccionar Excel de ejecución"
        />
      </PdmModal>

      <PdmArmonizacionModal
        open={modalArmonizacion}
        slug={slug}
        codigoOrigen={armonizacionCodigoOrigen}
        ptoDefinitivoOrigen={armonizacionPtoDefinitivo}
        saving={saving}
        setSaving={setSaving}
        onClose={() => setModalArmonizacion(false)}
        onSuccess={(detail) => {
          setError(null);
          setUploadFeedback({ tone: "success", title: "Armonización aplicada", detail });
        }}
        onError={(detail) => {
          setError(detail);
          setUploadFeedback({ tone: "error", title: "Error en armonización", detail });
        }}
      />

      <PdmModal
        open={modalContratos}
        title="Cargar contratos RPS"
        headerTone="primary"
        onClose={() => setModalContratos(false)}
        footer={
          <>
            <button type="button" onClick={() => setModalContratos(false)} className={pdmBtnSecondary}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!archivoContratos || saving || !slug}
              className={pdmBtnPrimary}
              onClick={() =>
                void (async () => {
                  if (!archivoContratos || !slug) return;
                  setSaving(true);
                  try {
                    const result = await pdmApi.uploadContratos(slug, archivoContratos, anioContratos);
                    setModalContratos(false);
                    setArchivoContratos(null);
                    invalidatePdm.afterUploadContratos(slug, anioContratos);
                    setError(null);
                    setUploadFeedback({
                      tone: "success",
                      title: "Contratos RPS cargados",
                      detail:
                        result.mensaje ||
                        `${result.registros_insertados ?? 0} nuevos, ${result.registros_actualizados ?? 0} actualizados (año ${anioContratos}).`,
                    });
                  } catch (e) {
                    const detail = formatApiError(e, "Error al cargar.");
                    setError(detail);
                    setUploadFeedback({
                      tone: "error",
                      title: "Error al cargar contratos RPS",
                      detail,
                    });
                  } finally {
                    setSaving(false);
                  }
                })()
              }
            >
              <Upload className="h-4 w-4" /> Cargar
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-slate-700">Año</label>
        <select className={`mt-1 ${pdmSelect}`} value={anioContratos} onChange={(e) => setAnioContratos(Number(e.target.value))}>
          {ANIOS_PDM.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="mt-3">
          <PdmAlert tone="info">
            Actualiza contratos existentes y agrega nuevos según producto y No. CRP (no elimina los que no vengan en el
            archivo).
          </PdmAlert>
        </div>
        <PdmFilePicker
          accept=".xlsx,.xls,.csv"
          file={archivoContratos}
          onChange={setArchivoContratos}
          emptyLabel="Seleccionar Excel de contratos RPS"
          hint={
            <>
              Columnas: <strong>PRODUCTO</strong>, <strong>NO CRP</strong> (o CRP / NO CRP/CRP), <strong>VALOR</strong>.
              Opcionales: CONCEPTO, CONTRATISTA.
            </>
          }
        />
      </PdmModal>

      {route === "detalle" && productoSeleccionado && mostrarModalActividad && (
        <PdmActividadModal
          open={mostrarModalActividad}
          anio={anioDetalle}
          producto={productoSeleccionado}
          secretarias={secretarias}
          contratistas={contratistas}
          canDelegate={canDelegateContratista}
          actividadEnEdicion={actividadEnEdicion}
          secretariaUsuarioId={secretariaUsuarioId}
          esSecretario={isSecretario}
          saving={guardandoEvidencia || saving}
          onClose={() => {
            setMostrarModalActividad(false);
            setActividadEnEdicion(null);
          }}
          onSave={guardarActividad}
        />
      )}

      <PdmBpinModal
        open={mostrarModalBpin}
        cargando={cargandoBpin}
        proyecto={proyectoBpin}
        error={errorBpin}
        consultaUrl={consultaUrlBpin}
        portalUrl={portalUrlBpin}
        onClose={cerrarModalBpin}
      />
    </>
  );
}
