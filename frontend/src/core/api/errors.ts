/** Convierte errores de axios/DRF en mensajes legibles para el usuario. */
export function formatApiError(err: unknown, fallback = "Ocurrió un error. Intenta de nuevo."): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
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
