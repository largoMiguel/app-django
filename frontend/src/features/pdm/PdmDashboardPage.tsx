import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { usePdm } from "@/features/pdm/PdmContext";
import { PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";

const PdmDashboard = lazy(() => import("@/features/pdm/PdmDashboard"));

export default function PdmDashboardPage() {
  const navigate = useNavigate();
  const { estadisticas, resumenEjecucion, isAdmin, abrirModalArmonizacion } = usePdm();

  if (!estadisticas) {
    return <PdmLoadingOverlay message="Cargando resumen..." />;
  }

  return (
    <Suspense fallback={<PdmLoadingOverlay message="Cargando vista..." />}>
      <PdmDashboard
        estadisticas={estadisticas}
        resumenEjecucion={resumenEjecucion}
        onVerProductos={() => navigate("/pdm/productos")}
        isAdmin={isAdmin}
        onArmonizar={(codigoOrigen, ptoDefinitivo) => abrirModalArmonizacion(codigoOrigen, ptoDefinitivo)}
      />
    </Suspense>
  );
}
