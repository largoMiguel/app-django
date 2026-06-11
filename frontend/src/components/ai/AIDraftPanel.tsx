import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Check, X } from "lucide-react";

interface Props {
  draft: string;
  loading?: boolean;
  onAccept: (text: string) => void;
  onRegenerate: () => void;
  onClose: () => void;
  normativa?: string;
}

export default function AIDraftPanel({
  draft,
  loading = false,
  onAccept,
  onRegenerate,
  onClose,
  normativa,
}: Props) {
  const [edited, setEdited] = useState(draft);

  useEffect(() => {
    setEdited(draft);
  }, [draft]);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
          <Sparkles className="w-4 h-4" />
          Borrador generado con IA
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {normativa && (
        <p className="text-xs text-slate-500">{normativa}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Generando borrador...
        </div>
      ) : (
        <textarea
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onAccept(edited)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Usar borrador
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onRegenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Regenerar
        </button>
        <span className="text-xs text-slate-400 ml-auto">Revisa y edita antes de enviar</span>
      </div>
    </div>
  );
}
