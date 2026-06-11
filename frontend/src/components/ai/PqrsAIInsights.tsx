import AIInsightsSection from "./AIInsightsSection";
import { usePqrsInsights } from "@/core/api/hooks/usePqrsAi";
import { useAuthStore } from "@/core/auth/store";

interface Props {
  title?: string;
  className?: string;
}

/** Insights IA del módulo PQRS (API /ai/pqrs/insights/). */
export default function PqrsAIInsights({
  title = "Insights IA PQRS",
  className,
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
    />
  );
}
