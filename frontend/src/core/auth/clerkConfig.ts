export function isClerkConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
}

/** Custom Frontend API domain (e.g. clerk.softone360.com). Omit if using Clerk-hosted URLs. */
export function getClerkDomain(): string | undefined {
  const domain = import.meta.env.VITE_CLERK_DOMAIN?.trim();
  return domain || undefined;
}
