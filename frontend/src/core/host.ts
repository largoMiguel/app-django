/** Origen de la app autenticada en producción (PQRS, PDM, login, etc.). */
export const APP_ORIGIN = "https://app.softone360.com";

/** Entorno demo (showcase + app en el mismo host). */
export const DEMO_ORIGIN = "https://demo.softone360.com";

/** Dominio de marketing (showcase). */
export const MARKETING_ORIGIN = "https://softone360.com";

const MARKETING_HOSTS = new Set(["softone360.com", "www.softone360.com"]);
const DEMO_HOSTS = new Set(["demo.softone360.com"]);

/** Build-time: stack demo sirve landing en `/` (incluye acceso LAN por IP). */
const showcaseFromBuild = import.meta.env.VITE_SHOWCASE_ROOT === "true";

export function isMarketingHost(hostname = window.location.hostname): boolean {
  return MARKETING_HOSTS.has(hostname);
}

export function isDemoHost(hostname = window.location.hostname): boolean {
  return DEMO_HOSTS.has(hostname) || showcaseFromBuild;
}

/** Landing pública: softone360.com (marketing) o demo.softone360.com. */
export function isShowcaseHost(hostname = window.location.hostname): boolean {
  return isMarketingHost(hostname) || isDemoHost(hostname);
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

/** Origen de login/app según el host (marketing → app prod; demo → mismo host). */
export function getAppOrigin(): string {
  if (isMarketingHost()) return APP_ORIGIN;
  if (typeof window !== "undefined") return window.location.origin;
  return DEMO_ORIGIN;
}

/** Redirección absoluta a la app (misma ruta/query). */
export function redirectToApp(path = window.location.pathname + window.location.search): void {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.replace(`${getAppOrigin()}${normalized}`);
}
