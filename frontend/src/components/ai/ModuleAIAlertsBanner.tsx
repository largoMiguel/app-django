import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";
import { useDismissAlert } from "@/core/api/hooks/useAi";
import { usePqrsAlerts } from "@/core/api/hooks/usePqrsAi";
import { usePdmAlerts } from "@/core/api/hooks/usePdmAi";
import type { AIAlert, AIModuleKey } from "@/core/api/ai/types";

interface Props {
  module: AIModuleKey;
  onAlertClick?: (alert: AIAlert) => void;
}

function alertIsClickable(alert: AIAlert, module: AIModuleKey): boolean {
  if (module === "pqrs" && alert.object_id) return true;
  if (module === "pdm" && alert.metadata?.codigo_producto) return true;
  return false;
}

/** Banner de alertas IA filtrado por módulo (PQRS o PDM). */
export default function ModuleAIAlertsBanner({ module, onAlertClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pqrsQuery = usePqrsAlerts(true, module === "pqrs");
  const pdmQuery = usePdmAlerts(true, module === "pdm");
  const alerts = module === "pqrs" ? pqrsQuery.data ?? [] : pdmQuery.data ?? [];
  const dismiss = useDismissAlert();

  if (!alerts.length) return null;

  const top = alerts[0];
  const hasMultiple = alerts.length > 1;

  async function handleDismiss(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await dismiss.mutateAsync(id);
    if (alerts.length <= 1) setExpanded(false);
  }

  function handleItemClick(alert: AIAlert) {
    if (onAlertClick && alertIsClickable(alert, module)) {
      onAlertClick(alert);
    }
  }

  function toggleExpanded() {
    if (hasMultiple) setExpanded((v) => !v);
    else if (onAlertClick && alertIsClickable(top, module)) {
      onAlertClick(top);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-amber-100/90 transition-colors"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
              {module === "pqrs" ? "PQRS" : "PDM"}
            </span>
            <span className="font-medium text-amber-900 text-sm">{top.title}</span>
            {top.score != null && <ConfidenceBadge score={top.score} size="sm" />}
            {hasMultiple && (
              <span className="text-xs text-amber-600 font-medium">
                +{alerts.length - 1} más
              </span>
            )}
          </div>
          <p className="text-xs text-amber-700 mt-0.5 truncate">{top.message}</p>
          <p className="text-[0.65rem] text-amber-600 mt-1">
            {hasMultiple
              ? expanded
                ? "Clic para ocultar la lista"
                : `Clic para ver las ${alerts.length} alertas`
              : "Clic para ver detalle"}
          </p>
        </div>
        {hasMultiple ? (
          <ChevronDown
            className={`w-4 h-4 text-amber-600 shrink-0 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        ) : (
          <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
        )}
        <button
          type="button"
          onClick={(e) => handleDismiss(e, top.id)}
          className="text-amber-400 hover:text-amber-600 shrink-0 p-1"
          aria-label="Descartar alerta"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {expanded && hasMultiple && (
        <ul className="border-t border-amber-200 bg-amber-50/80 max-h-72 overflow-y-auto">
          {alerts.map((alert) => {
            const itemClickable = Boolean(onAlertClick) && alertIsClickable(alert, module);
            return (
              <li
                key={alert.id}
                className="flex items-start gap-2 px-3 py-2.5 border-b border-amber-100 last:border-0 hover:bg-amber-100/60"
              >
                <button
                  type="button"
                  disabled={!itemClickable}
                  onClick={() => handleItemClick(alert)}
                  className={`flex-1 min-w-0 text-left ${
                    itemClickable ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-amber-900">{alert.title}</span>
                    {alert.score != null && (
                      <ConfidenceBadge score={alert.score} size="sm" />
                    )}
                  </div>
                  <p className="text-xs text-amber-700 mt-0.5 line-clamp-2">{alert.message}</p>
                  {itemClickable && (
                    <span className="text-[0.65rem] text-amber-600 mt-1 inline-flex items-center gap-0.5">
                      Ver detalle <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDismiss(e, alert.id)}
                  className="text-amber-400 hover:text-amber-600 shrink-0 p-1 mt-0.5"
                  aria-label="Descartar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
