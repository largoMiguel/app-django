/** Origen de la app autenticada (PQRS, PDM, login, etc.). */
export const APP_ORIGIN = "https://app.softone360.com";

/** Dominio de marketing (showcase). */
export const MARKETING_ORIGIN = "https://softone360.com";

const MARKETING_HOSTS = new Set(["softone360.com", "www.softone360.com"]);

export function isMarketingHost(hostname = window.location.hostname): boolean {
  return MARKETING_HOSTS.has(hostname);
}

export function isWwwHost(hostname = window.location.hostname): boolean {
  return hostname === "www.softone360.com";
}

/** www → apex (por si el edge no tiene redirect rule aún). */
export function redirectWwwToApex(): boolean {
  if (!isWwwHost()) return false;
  const { pathname, search, hash } = window.location;
  window.location.replace(`${MARKETING_ORIGIN}${pathname}${search}${hash}`);
  return true;
}

/** Redirección absoluta a la app (misma ruta/query). */
export function redirectToApp(path = window.location.pathname + window.location.search): void {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.replace(`${APP_ORIGIN}${normalized}`);
}
