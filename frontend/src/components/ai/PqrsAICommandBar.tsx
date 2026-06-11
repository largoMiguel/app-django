import AICommandBar from "./AICommandBar";
import { pqrsAiApi } from "@/core/api/ai/pqrs";
import { useAuthStore } from "@/core/auth/store";
import type { SemanticSearchResult } from "@/core/api/ai/types";

interface Props {
  placeholder?: string;
  onResultClick?: (result: SemanticSearchResult) => void;
  className?: string;
}

/** Búsqueda inteligente PQRS (API /ai/search/). */
export default function PqrsAICommandBar({
  placeholder = "Búsqueda inteligente en PQRS...",
  onResultClick,
  className,
}: Props) {
  const enabled = Boolean(useAuthStore((s) => s.user?.entity?.enable_pqrs));

  if (!enabled) return null;

  return (
    <AICommandBar
      placeholder={placeholder}
      contentTypes={["pqrs_descripcion", "pqrs_respuesta"]}
      onResultClick={onResultClick}
      className={className}
      searchFn={(query, contentTypes, limit) =>
        pqrsAiApi.search(query, contentTypes, limit)
      }
    />
  );
}
