/** Mensajes de bloqueo de acceso (cuenta/entidad inactiva, no provisionada). */
export const AUTH_BLOCK_MESSAGE_KEY = "softone.auth_block_message";

export type AuthBlockCode =
  | "user_inactive"
  | "entity_inactive"
  | "user_not_provisioned"
  | "clerk_no_email";

const MESSAGES: Record<AuthBlockCode, string> = {
  user_inactive: "Tu cuenta está inhabilitada. Contacta al administrador.",
  entity_inactive:
    "La entidad a la que perteneces está inactiva. Contacta al administrador.",
  user_not_provisioned:
    "Tu cuenta no está registrada en SoftOne. Contacta al administrador.",
  clerk_no_email:
    "Tu cuenta de Clerk no tiene email configurado. Contacta al administrador.",
};

function detailText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as { detail?: string | { string?: string }[] };
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail) && d.detail[0] && typeof d.detail[0] === "object") {
    return String((d.detail[0] as { string?: string }).string ?? "");
  }
  return "";
}

/** Extrae código DRF de un error axios/fetch. */
export function parseAuthErrorCode(err: unknown): AuthBlockCode | null {
  const data = (err as { response?: { data?: { code?: string; detail?: unknown } } })
    ?.response?.data;
  const code = data?.code;
  if (
    code === "user_inactive" ||
    code === "entity_inactive" ||
    code === "user_not_provisioned" ||
    code === "clerk_no_email"
  ) {
    return code;
  }
  const text = detailText(data);
  if (text.includes("inhabilitada")) return "user_inactive";
  if (text.includes("entidad") && text.includes("inactiva")) return "entity_inactive";
  if (text.includes("no está registrada")) return "user_not_provisioned";
  return null;
}

export function messageForAuthBlock(code: AuthBlockCode): string {
  return MESSAGES[code];
}

export function setAuthBlockMessage(codeOrText: AuthBlockCode | string): void {
  const msg =
    codeOrText in MESSAGES
      ? MESSAGES[codeOrText as AuthBlockCode]
      : codeOrText;
  sessionStorage.setItem(AUTH_BLOCK_MESSAGE_KEY, msg);
}

export function consumeAuthBlockMessage(): string | null {
  const msg = sessionStorage.getItem(AUTH_BLOCK_MESSAGE_KEY);
  if (msg) sessionStorage.removeItem(AUTH_BLOCK_MESSAGE_KEY);
  return msg;
}

/** Cierra sesión Clerk y limpia estado local; opcional mensaje en login. */
export async function forceClerkSignOut(blockCode?: AuthBlockCode | null): Promise<void> {
  if (blockCode) {
    setAuthBlockMessage(blockCode);
  }
  try {
    await window.Clerk?.signOut();
  } catch {
    /* ignore */
  }
}
