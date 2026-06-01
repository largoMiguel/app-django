/** Convierte errores de axios/DRF en mensajes legibles para el usuario. */
export function formatApiError(err: unknown, fallback = "Ocurrió un error. Intenta de nuevo."): string {
  if (err instanceof Error && err.message && !(err as { response?: unknown }).response) {
    return err.message;
  }

  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data) {
    const message = (err as { message?: unknown })?.message;
    return typeof message === "string" && message ? message : fallback;
  }
  if (typeof data === "string") {
    const trimmed = data.trimStart();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) return fallback;
    return data;
  }
  if (typeof data !== "object" || data === null) return fallback;

  const obj = data as Record<string, unknown>;
  if (typeof obj.detail === "string") return obj.detail;
  if (Array.isArray(obj.detail)) return obj.detail.map(String).join(" · ");

  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "non_field_errors" && Array.isArray(value)) {
      parts.push(value.map(String).join(", "));
      continue;
    }
    if (Array.isArray(value)) parts.push(`${key}: ${value.map(String).join(", ")}`);
    else if (typeof value === "string") parts.push(`${key}: ${value}`);
  }
  return parts.length ? parts.join(" · ") : fallback;
}
