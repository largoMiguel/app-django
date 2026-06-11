import AIInsightsSection from "./AIInsightsSection";
import { usePqrsInsights } from "@/core/api/hooks/usePqrsAi";
import { useAuthStore } from "@/core/auth/store";
import type { AIInsight } from "@/core/api/ai/types";

interface Props {
  title?: string;
  className?: string;
  onInsightClick?: (insight: AIInsight) => void;
}

/** Insights IA del módulo PQRS (API /ai/pqrs/insights/). */
export default function PqrsAIInsights({
  title = "Insights IA PQRS",
  className,
  onInsightClick,
}: Props) {
  const enabled = Boolean(useAuthStore((s) => s.user?.entity?.enable_pqrs));
  const { data, isLoading } = usePqrsInsights(enabled);

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
