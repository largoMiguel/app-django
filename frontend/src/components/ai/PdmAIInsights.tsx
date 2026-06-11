import AIInsightsSection from "./AIInsightsSection";
import { usePdmInsights } from "@/core/api/hooks/usePdmAi";
import { useAuthStore } from "@/core/auth/store";
import type { AIInsight } from "@/core/api/ai/types";

interface Props {
  slug: string;
  anio?: number;
  title?: string;
  className?: string;
  onInsightClick?: (insight: AIInsight) => void;
}

/** Insights IA del módulo PDM (API /ai/pdm/{slug}/insights/). */
export default function PdmAIInsights({
  slug,
  anio,
  title = "Insights IA del PDM",
  className,
  onInsightClick,
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
      onInsightClick={onInsightClick}
    />
  );
}
