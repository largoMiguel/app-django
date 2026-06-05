import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { authApi } from "@/core/auth/api";
import { useAuthStore } from "@/core/auth/store";
import {
  forceClerkSignOut,
  parseAuthErrorCode,
} from "@/core/auth/authErrors";
import { clearClientSession } from "@/core/auth/session";

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [profileReady, setProfileReady] = useState(!isSignedIn);

  // Revocación de sesión / cierre en todos los dispositivos (Clerk rota token ~cada 20s).
  useEffect(() => {
    const clerk = window.Clerk;
    if (!clerk?.addListener) return;

    const unsubscribe = clerk.addListener((payload: { session?: { id?: string } | null }) => {
      const session = payload.session ?? clerk.session;
      const signedIn = Boolean(session?.id);
      if (!signedIn) {
        clearClientSession();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      logout();
      setProfileReady(true);
      return;
    }

    let cancelled = false;
    setProfileReady(false);
    authApi
      .me()
      .then((user) => {
        if (!cancelled) setUser(user);
      })
      .catch(async (err) => {
        if (cancelled) return;
        const blockCode = parseAuthErrorCode(err);
        logout();
        await forceClerkSignOut(blockCode);
      })
      .finally(() => {
        if (!cancelled) setProfileReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setUser, logout]);

  if (!isLoaded || (isSignedIn && !profileReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Cargando sesión…
      </div>
    );
  }

  return <>{children}</>;
}
