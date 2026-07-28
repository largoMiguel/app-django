import { authApi } from "@/core/auth/api";
import { parseAuthErrorCode } from "@/core/auth/authErrors";
import { getClerkToken } from "@/core/auth/clerkToken";
import type { AuthUser } from "@/core/auth/store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera a que Clerk exponga un JWT (puede tardar un instante tras el login). */
async function waitForClerkToken(maxAttempts = 12, delayMs = 250): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const token = await getClerkToken();
    if (token) return token;
    await sleep(delayMs);
  }
  return null;
}

/**
 * Carga /auth/me con reintentos: evita 401 por token aún no listo
 * y fallos transitorios de red justo después del sign-in de Clerk.
 */
export async function loadAuthProfile(): Promise<AuthUser> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = await waitForClerkToken(attempt === 0 ? 8 : 4);
    if (!token) {
      lastError = new Error("clerk_token_unavailable");
      await sleep(300 * (attempt + 1));
      continue;
    }

    try {
      return await authApi.me();
    } catch (err) {
      lastError = err;
      const blockCode = parseAuthErrorCode(err);
      if (blockCode) throw err;

      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403 || status === 502 || status === 503) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("auth_profile_load_failed");
}
