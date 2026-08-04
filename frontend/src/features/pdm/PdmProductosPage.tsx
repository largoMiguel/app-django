import { lazy, Suspense } from "react";
import { usePdm } from "@/features/pdm/PdmContext";
import { PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";

const PdmProductosView = lazy(() => import("@/features/pdm/PdmProductosView"));

export default function PdmProductosPage() {
  const pdm = usePdm();

  return (
    <Suspense fallback={<PdmLoadingOverlay message="Cargando productos..." />}>
      <PdmProductosView
        filtroAnio={pdm.filtroAnio}
        onFiltroAnio={pdm.setFiltroAnio}
        meta={pdm.meta}
        secretarias={pdm.secretarias}
        contratistas={pdm.contratistas}
        isAdmin={pdm.isAdmin}
        canDelegateContratista={pdm.canDelegateContratista}
        saving={pdm.saving}
        productos={pdm.resumenProductos}
        totalCount={pdm.totalCount}
        currentPage={pdm.currentPage}
        totalPages={pdm.totalPages}
        isLoading={pdm.loadingProductos}
        statsEstado={pdm.statsEstado}
        ejecucionAnio={pdm.statsData?.ejecucion_anio}
        filtroLinea={pdm.filtroLinea}
        filtroSector={pdm.filtroSector}
        filtroSecretaria={pdm.filtroSecretaria}
        filtroOds={pdm.filtroOds}
        filtroTipoAcumulacion={pdm.filtroTipoAcumulacion}
        filtroEstado={pdm.filtroEstado}
        filtroBusqueda={pdm.filtroBusqueda}
        onFiltroLinea={pdm.setFiltroLinea}
        onFiltroSector={pdm.setFiltroSector}
        onFiltroSecretaria={pdm.setFiltroSecretaria}
        onFiltroOds={pdm.setFiltroOds}
        onFiltroTipoAcumulacion={pdm.setFiltroTipoAcumulacion}
        onFiltroEstado={pdm.setFiltroEstado}
        onFiltroBusqueda={pdm.setFiltroBusqueda}
        onLimpiarFiltros={pdm.limpiarFiltros}
        onPageChange={pdm.setCurrentPage}
        onOpenDetalle={pdm.openDetalle}
        onAsignar={pdm.handleAsignar}
        onAsignarUsuario={pdm.handleAsignarUsuario}
      />
    </Suspense>
  );
}
