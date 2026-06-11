import { AlertTriangle, X, ChevronRight } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";
import { useDismissAlert } from "@/core/api/hooks/useAi";
import { usePqrsAlerts } from "@/core/api/hooks/usePqrsAi";
import { usePdmAlerts } from "@/core/api/hooks/usePdmAi";
import type { AIAlert, AIModuleKey } from "@/core/api/ai/types";

interface Props {
  module: AIModuleKey;
  onAlertClick?: (alert: AIAlert) => void;
}

/** Banner de alertas IA filtrado por módulo (PQRS o PDM). */
export default function ModuleAIAlertsBanner({ module, onAlertClick }: Props) {
  const pqrsQuery = usePqrsAlerts(true, module === "pqrs");
  const pdmQuery = usePdmAlerts(true, module === "pdm");
  const alerts = module === "pqrs" ? pqrsQuery.data ?? [] : pdmQuery.data ?? [];
  const dismiss = useDismissAlert();

  if (!alerts.length) return null;

  const top = alerts[0];

  async function handleDismiss(id: number) {
    await dismiss.mutateAsync(id);
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
            {module === "pqrs" ? "PQRS" : "PDM"}
          </span>
          <span className="font-medium text-amber-900 text-sm">{top.title}</span>
          {top.score != null && <ConfidenceBadge score={top.score} size="sm" />}
          {alerts.length > 1 && (
            <span className="text-xs text-amber-600">+{alerts.length - 1} más</span>
          )}
        </div>
        <p className="text-xs text-amber-700 mt-0.5 truncate">{top.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onAlertClick?.(top)}
        className="text-amber-600 hover:text-amber-800 shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => handleDismiss(top.id)}
        className="text-amber-400 hover:text-amber-600 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
