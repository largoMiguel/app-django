import { lazy, Suspense } from "react";
import { usePdm } from "@/features/pdm/PdmContext";
import { PdmAlert, PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";
import { pdmBtnSecondary } from "@/features/pdm/pdmStyles";

const PdmProductoDetalle = lazy(() => import("@/features/pdm/PdmProductoDetalle"));

export default function PdmProductoDetallePage() {
  const pdm = usePdm();

  if (pdm.detalleFetchError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <PdmAlert tone="error">{pdm.detalleFetchError}</PdmAlert>
        <button type="button" className={pdmBtnSecondary} onClick={pdm.volverDesdeDetalle}>
          Volver
        </button>
      </div>
    );
  }

  if (pdm.loadingProductoDetail || !pdm.productoSeleccionado || !pdm.resumenAnioDetalle) {
    return <PdmLoadingOverlay message="Cargando producto..." />;
  }

  return (
    <Suspense fallback={<PdmLoadingOverlay message="Cargando detalle..." />}>
      <PdmProductoDetalle
        producto={pdm.productoSeleccionado}
        anioDetalle={pdm.anioDetalle}
        onAnioDetalle={pdm.setAnioDetalle}
        resumenAnioDetalle={pdm.resumenAnioDetalle}
        comparativaPresupuestal={pdm.comparativaPresupuestal}
        ejecucionPresupuestal={pdm.ejecucionPresupuestal}
        cargandoEjecucion={pdm.cargandoEjecucion}
        contratosRPS={pdm.contratosRPS}
        cargandoContratos={pdm.cargandoContratos}
        cargandoActividadesBackend={pdm.loadingProductoDetail}
        saving={pdm.saving}
        puedeCrearEvidencia={pdm.puedeCrearEvidencia}
        isAdmin={pdm.isAdmin}
        onNuevaActividad={() => {
          pdm.setActividadEnEdicion(null);
          pdm.setMostrarModalActividad(true);
        }}
        onEditarActividad={pdm.handleEditarActividad}
        onEliminarActividad={pdm.handleEliminarActividad}
        onCargarEvidencia={pdm.handleCargarEvidencia}
        unidad={pdm.productoSeleccionado.unidad_medida || "N/D"}
        onAbrirBpin={pdm.handleAbrirBpin}
        onGestionarArmonizaciones={() => pdm.abrirModalArmonizacion()}
      />
    </Suspense>
  );
}
