/** Fetch Clerk session JWT for API calls (works outside React hooks). */
export async function getClerkToken(): Promise<string | null> {
  try {
    const token = await window.Clerk?.session?.getToken();
    return token ?? null;
  } catch {
    return null;
  }
}
