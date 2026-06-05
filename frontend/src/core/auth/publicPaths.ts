/** Rutas que no requieren sesión Clerk ni bootstrap de perfil Django. */
export function isPublicAppPath(pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/portal/")) return true;
  if (pathname.startsWith("/chat/")) return true;
  return false;
}
