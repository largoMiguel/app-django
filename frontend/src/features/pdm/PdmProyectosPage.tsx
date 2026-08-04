import { lazy, Suspense } from "react";
import { usePdm } from "@/features/pdm/PdmContext";
import { PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";

const PdmProyectosView = lazy(() => import("@/features/pdm/PdmProyectosView"));

export default function PdmProyectosPage() {
  const { proyectosData, loadingProyectos, openProductoFromProyectos } = usePdm();

  return (
    <Suspense fallback={<PdmLoadingOverlay message="Cargando proyectos..." />}>
      <PdmProyectosView data={proyectosData} isLoading={loadingProyectos} onOpenProducto={openProductoFromProyectos} />
    </Suspense>
  );
}
