import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { isClerkConfigured } from "@/core/auth/clerkConfig";
import { useAuthStore } from "@/core/auth/store";
import {
  forceClerkSignOut,
  parseAuthErrorCode,
} from "@/core/auth/authErrors";
import { isPublicAppPath } from "@/core/auth/publicPaths";
import { clearClientSession } from "@/core/auth/session";
import { loadAuthProfile } from "@/core/auth/loadAuthProfile";
import SessionLoadingScreen from "@/components/ui/SessionLoadingScreen";

function AuthBootstrapWithClerk({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isPublic = isPublicAppPath(pathname);
  const { isLoaded, isSignedIn } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [profileReady, setProfileReady] = useState(!isSignedIn);

  useEffect(() => {
    const clerk = window.Clerk;
    if (!clerk?.addListener) return;

    const unsubscribe = clerk.addListener((payload: { session?: { id?: string } | null }) => {
      const session = payload.session ?? clerk.session;
      const signedIn = Boolean(session?.id);
      if (!signedIn) {
        clearClientSession();
        if (!isPublicAppPath(window.location.pathname)) {
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

    loadAuthProfile()
      .then((user) => {
        if (!cancelled) setUser(user);
      })
      .catch(async (err) => {
        if (cancelled) return;
        const blockCode = parseAuthErrorCode(err);
        logout();
        if (blockCode) {
          await forceClerkSignOut(blockCode);
        } else {
          await forceClerkSignOut();
        }
      })
      .finally(() => {
        if (!cancelled) setProfileReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setUser, logout]);

  if (!isLoaded) {
    return <SessionLoadingScreen message="Iniciando…" />;
  }

  // Tras login Clerk: esperar perfil Django en TODAS las rutas (incl. /login y /).
  if (isSignedIn && !profileReady) {
    return <SessionLoadingScreen />;
  }

  // Visitante anónimo en ruta protegida: RequireAuth redirige; no bloquear aquí.
  if (!isSignedIn && !isPublic && !profileReady) {
    return <SessionLoadingScreen message="Iniciando…" />;
  }

  return <>{children}</>;
}

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  if (!isClerkConfigured()) {
    return <>{children}</>;
  }

  return <AuthBootstrapWithClerk>{children}</AuthBootstrapWithClerk>;
}
