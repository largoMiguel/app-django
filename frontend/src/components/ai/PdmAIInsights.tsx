import AIInsightsSection from "./AIInsightsSection";
import { usePdmInsights } from "@/core/api/hooks/usePdmAi";
import { useAuthStore } from "@/core/auth/store";

interface Props {
  slug: string;
  anio?: number;
  title?: string;
  className?: string;
}

/** Insights IA del módulo PDM (API /ai/pdm/{slug}/insights/). */
export default function PdmAIInsights({
  slug,
  anio,
  title = "Insights IA del PDM",
  className,
}: Props) {
  const enabled = Boolean(useAuthStore((s) => s.user?.entity?.enable_pdm));
  const { data, isLoading } = usePdmInsights(slug, anio, enabled && Boolean(slug));

  if (!enabled) return null;

  return (
    <AIInsightsSection
      insights={data?.insights ?? []}
      loading={isLoading}
      title={title}
      className={className}
    />
  );
}
