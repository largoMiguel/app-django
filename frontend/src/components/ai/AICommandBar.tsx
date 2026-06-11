import { useState, useRef, useEffect } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { aiApi, type SemanticSearchResult } from "@/core/api/ai";
import { formatApiError } from "@/core/api/errors";

interface Props {
  placeholder?: string;
  contentTypes?: string[];
  onResultClick?: (result: SemanticSearchResult) => void;
  className?: string;
}

export default function AICommandBar({
  placeholder = "Búsqueda inteligente...",
  contentTypes,
  onResultClick,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setResults([]);
      setOpen(false);
      setHint(null);
      setSearchMode(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await aiApi.semanticSearch(query, contentTypes, 8);
        setResults(data.results);
        setHint(data.hint ?? null);
        setSearchMode(data.search_mode ?? null);
        setOpen(true);
      } catch (err) {
        setError(formatApiError(err));
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, contentTypes]);

  const showDropdown = open && query.length >= 3 && !loading;

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-300">
        <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
        />
        {loading && <Search className="w-4 h-4 text-slate-400 animate-pulse" />}
        {query && (
          <button type="button" onClick={() => { setQuery(""); setOpen(false); }}>
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {hint && (
            <p className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
              {hint}
            </p>
          )}
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              Sin resultados para &quot;{query}&quot;.
              {searchMode === "none" && " Prueba con palabras del asunto o radicado."}
            </p>
          ) : (
            results.map((r) => (
              <button
                key={`${r.content_type}-${r.object_id}`}
                type="button"
                onClick={() => {
                  onResultClick?.(r);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-blue-600">
                    {r.metadata?.numero_radicado as string | undefined ?? r.content_type}
                  </span>
                  <span className="text-xs text-slate-400">
                    {Math.round(r.similarity * 100)}% match
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-0.5 line-clamp-2">{r.texto}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
