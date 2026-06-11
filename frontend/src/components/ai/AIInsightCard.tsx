import { AlertTriangle, ChevronRight, Info, TrendingUp } from "lucide-react";
import type { AIInsight } from "@/core/api/ai/types";
import ConfidenceBadge from "./ConfidenceBadge";

interface Props {
  insight: AIInsight;
  className?: string;
  onClick?: (insight: AIInsight) => void;
}

const SEVERITY_STYLES = {
  low: { bg: "bg-slate-50 border-slate-200", icon: Info, color: "text-slate-500" },
  medium: { bg: "bg-amber-50 border-amber-200", icon: TrendingUp, color: "text-amber-600" },
  high: { bg: "bg-red-50 border-red-200", icon: AlertTriangle, color: "text-red-600" },
};

export function insightIsClickable(insight: AIInsight): boolean {
  const meta = insight.metadata;
  if (!meta) return false;
  return Boolean(meta.pqrs_id || meta.codigo_producto);
}

export default function AIInsightCard({ insight, className = "", onClick }: Props) {
  const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.low;
  const Icon = style.icon;
  const clickable = Boolean(onClick) && insightIsClickable(insight);

  const inner = (
    <div className="flex items-start gap-3">
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="font-medium text-slate-800 text-sm">{insight.title}</h4>
          <ConfidenceBadge
            score={
              insight.score ??
              (insight.severity === "high" ? 85 : insight.severity === "medium" ? 60 : 30)
            }
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{insight.text}</p>
        {clickable && (
          <p className="text-[0.65rem] text-slate-500 mt-2 flex items-center gap-1">
            Ver detalle <ChevronRight className="w-3 h-3" />
          </p>
        )}
      </div>
    </div>
  );

  if (!clickable) {
    return (
      <div className={`rounded-xl border p-4 ${style.bg} ${className}`}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(insight)}
      className={`rounded-xl border p-4 w-full text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${style.bg} ${className}`}
    >
      {inner}
    </button>
  );
}
