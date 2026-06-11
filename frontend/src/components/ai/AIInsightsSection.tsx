import { Sparkles } from "lucide-react";
import type { AIInsight } from "@/core/api/ai";
import AIInsightCard from "./AIInsightCard";

interface Props {
  insights: AIInsight[];
  title?: string;
  loading?: boolean;
}

export default function AIInsightsSection({
  insights,
  title = "Insights IA",
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Sparkles className="w-4 h-4 animate-pulse" />
          Generando insights...
        </div>
      </div>
    );
  }

  if (!insights.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500" />
        <h3 className="font-medium text-slate-800 text-sm">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {insights.map((insight, i) => (
          <AIInsightCard key={`${insight.title}-${i}`} insight={insight} />
        ))}
      </div>
    </div>
  );
}
