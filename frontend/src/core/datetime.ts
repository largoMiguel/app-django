/** Fechas y horas en zona horaria de Colombia (America/Bogota), formato 24h. */

export const CO_TIMEZONE = "America/Bogota";

export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** dd/mm/aaaa */
export function formatFechaCO(value?: string | null, fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: CO_TIMEZONE,
  }).format(date);
}

/** dd/mm/aaaa, HH:mm (24h) */
export function formatFechaHoraCO(value?: string | null, fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: CO_TIMEZONE,
  }).format(date);
}

/** HH:mm (24h) */
export function formatHoraCO(value?: string | null, fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: CO_TIMEZONE,
  }).format(date);
}

/** Valor para `<input type="date">` en calendario de Colombia (YYYY-MM-DD). */
export function toDateInputValueCO(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: CO_TIMEZONE }).format(date);
}

/** Medianoche en Colombia → ISO UTC (evita desfase al guardar fechas sin hora). */
export function dateInputValueToIsoCO(dateStr: string): string {
  return `${dateStr}T05:00:00.000Z`;
}

/** Fecha de hoy en Colombia para inputs type=date. */
export function todayDateInputValueCO(): string {
  return toDateInputValueCO(new Date().toISOString());
}
