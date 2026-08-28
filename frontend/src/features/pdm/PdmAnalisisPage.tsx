import { lazy, Suspense } from "react";
import ModuleAIAlertsBanner from "@/components/ai/ModuleAIAlertsBanner";
import PdmAIInsights from "@/components/ai/PdmAIInsights";
import { usePdm } from "@/features/pdm/PdmContext";
import { PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";

const PdmAnalisis = lazy(() => import("@/features/pdm/PdmAnalisis"));

export default function PdmAnalisisPage() {
  const {
    slug,
    enablePdm,
    isAdmin,
    filtroAnioAnalisis,
    setFiltroAnioAnalisis,
    filtroSecretariaAnalisis,
    setFiltroSecretariaAnalisis,
    secretarias,
    openDetalleByCodigo,
  } = usePdm();

  return (
    <>
      {enablePdm && (
        <ModuleAIAlertsBanner
          module="pdm"
          onAlertClick={(a) => {
            const clave =
              (a.metadata?.clave_producto as string | undefined) ||
              (a.metadata?.codigo_producto as string | undefined);
            if (clave) openDetalleByCodigo(clave, "analisis");
          }}
        />
      )}

      {enablePdm && (
        <PdmAIInsights
          slug={slug}
          anio={filtroAnioAnalisis === "all" ? undefined : filtroAnioAnalisis}
          title="Insights IA del PDM"
          onInsightClick={(insight) => {
            const clave =
              (insight.metadata?.clave_producto as string | undefined) ||
              (insight.metadata?.codigo_producto as string | undefined);
            if (clave) openDetalleByCodigo(clave, "analisis");
          }}
        />
      )}

      <Suspense fallback={<PdmLoadingOverlay message="Cargando análisis..." />}>
        <PdmAnalisis
          slug={slug}
          filtroAnio={filtroAnioAnalisis}
          onFiltroAnio={setFiltroAnioAnalisis}
          filtroSecretaria={filtroSecretariaAnalisis}
          onFiltroSecretaria={setFiltroSecretariaAnalisis}
          secretarias={secretarias}
          isAdmin={isAdmin}
        />
      </Suspense>
    </>
  );
}
