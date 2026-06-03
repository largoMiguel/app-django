import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { authApi } from "@/core/auth/api";
import { useAuthStore } from "@/core/auth/store";

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [profileReady, setProfileReady] = useState(!isSignedIn);

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
      .catch(() => {
        if (!cancelled) logout();
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
