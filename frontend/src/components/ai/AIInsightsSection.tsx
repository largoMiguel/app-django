import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, Sparkles, X } from "lucide-react";
import type { AIInsight, AIModuleKey } from "@/core/api/ai/types";
import { useIgnoreInsight, useIgnoredInsights, useRestoreInsight } from "@/core/api/hooks/useAi";
import AIInsightCard from "./AIInsightCard";
import { isInsightsPanelHidden, setInsightsPanelHidden } from "./aiInsightsStorage";

interface Props {
  module: AIModuleKey;
  insights: AIInsight[];
  title?: string;
  loading?: boolean;
  className?: string;
  onInsightClick?: (insight: AIInsight) => void;
}

function IgnoredInsightsModal({
  open,
  module,
  onClose,
}: {
  open: boolean;
  module: AIModuleKey;
  onClose: () => void;
}) {
  const { data: ignored = [], isLoading } = useIgnoredInsights(module, open);
  const restore = useRestoreInsight(module);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Insights ignorados</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : ignored.length === 0 ? (
            <p className="text-sm text-slate-500">No hay insights ignorados.</p>
          ) : (
            <ul className="space-y-2">
              {ignored.map((item) => (
                <li
                  key={item.fingerprint}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{item.title || "Sin título"}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(item.fingerprint)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIInsightsSection({
  module,
  insights,
  title = "Insights IA",
  loading = false,
  className = "",
  onInsightClick,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => isInsightsPanelHidden(module));
  const [showIgnored, setShowIgnored] = useState(false);
  const ignore = useIgnoreInsight(module);
  const { data: ignoredList = [] } = useIgnoredInsights(module, !collapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setInsightsPanelHidden(module, next);
  }

  async function handleIgnore(e: React.MouseEvent, insight: AIInsight) {
    e.stopPropagation();
    if (!insight.fingerprint) return;
    await ignore.mutateAsync({ fingerprint: insight.fingerprint, title: insight.title });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Generando insights…
        </div>
      </div>
    );
  }

  const hasContent = insights.length > 0 || ignoredList.length > 0;

  if (!hasContent && collapsed) return null;

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-medium text-slate-800">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {ignoredList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowIgnored(true)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Ver ignorados ({ignoredList.length})
              </button>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {collapsed ? (
                <>
                  <Eye size={14} />
                  Mostrar
                </>
              ) : (
                <>
                  <EyeOff size={14} />
                  Ocultar
                </>
              )}
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {!collapsed && insights.length === 0 && (
          <p className="text-sm text-slate-500">No hay insights activos para mostrar.</p>
        )}

        {!collapsed && insights.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {insights.map((insight) => (
              <div key={insight.fingerprint ?? insight.title} className="relative">
                <AIInsightCard insight={insight} onClick={onInsightClick} />
                {insight.fingerprint && (
                  <button
                    type="button"
                    title="Ignorar este insight"
                    onClick={(e) => handleIgnore(e, insight)}
                    disabled={ignore.isPending}
                    className="absolute right-2 top-2 rounded-md bg-white/90 p-1 text-slate-400 shadow-sm hover:bg-white hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <IgnoredInsightsModal open={showIgnored} module={module} onClose={() => setShowIgnored(false)} />
    </>
  );
}
