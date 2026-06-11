import { AlertTriangle, Info, TrendingUp } from "lucide-react";
import type { AIInsight } from "@/core/api/ai";
import ConfidenceBadge from "./ConfidenceBadge";

interface Props {
  insight: AIInsight;
  className?: string;
}

const SEVERITY_STYLES = {
  low: { bg: "bg-slate-50 border-slate-200", icon: Info, color: "text-slate-500" },
  medium: { bg: "bg-amber-50 border-amber-200", icon: TrendingUp, color: "text-amber-600" },
  high: { bg: "bg-red-50 border-red-200", icon: AlertTriangle, color: "text-red-600" },
};

export default function AIInsightCard({ insight, className = "" }: Props) {
  const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.low;
  const Icon = style.icon;

  return (
    <div className={`rounded-xl border p-4 ${style.bg} ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
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
        </div>
      </div>
    </div>
  );
}
