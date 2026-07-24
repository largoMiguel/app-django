/** Detect signed B2 delivery URLs (Worker or Django fallback). */
export function isSignedDeliveryUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.searchParams.has("sig") || !parsed.searchParams.has("exp")) {
      return false;
    }
    const configuredHost = import.meta.env.VITE_FILE_DELIVERY_HOST?.trim();
    if (configuredHost) {
      return parsed.hostname === configuredHost;
    }
    return true;
  } catch {
    return false;
  }
}
