import { useEffect, useState } from "react";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import { aiApi, type AIAlert } from "@/core/api/ai";
import ConfidenceBadge from "./ConfidenceBadge";

interface Props {
  onAlertClick?: (alert: AIAlert) => void;
}

export default function AIAlertsBanner({ onAlertClick }: Props) {
  const [alerts, setAlerts] = useState<AIAlert[]>([]);

  useEffect(() => {
    aiApi.alerts(true).then(setAlerts).catch(() => {});
  }, []);

  async function dismiss(id: number) {
    await aiApi.dismissAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  if (!alerts.length) return null;

  const top = alerts[0];

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
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
      <button type="button" onClick={() => dismiss(top.id)} className="text-amber-400 hover:text-amber-600 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
