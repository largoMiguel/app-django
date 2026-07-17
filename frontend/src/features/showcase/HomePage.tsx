import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { firstAccessibleRoute } from "@/core/auth/routes";
import { useAuthStore } from "@/core/auth/store";
import { APP_ORIGIN, isMarketingHost, redirectToApp } from "@/core/host";
import LoginModal from "./LoginModal";
import ShowcasePage from "./ShowcasePage";

export default function HomePage() {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const [loginOpen, setLoginOpen] = useState(false);
  const marketing = isMarketingHost();

  useEffect(() => {
    document.body.classList.add("showcase-active");
    return () => {
      document.body.classList.remove("showcase-active");
    };
  }, []);

  useEffect(() => {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from;
    if (from?.pathname) {
      if (marketing) {
        window.location.href = `${APP_ORIGIN}/login`;
        return;
      }
      setLoginOpen(true);
    }
  }, [location.state, marketing]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Cargando…
      </div>
    );
  }

  if (isSignedIn) {
    if (!user) {
      return (
        <div className="flex min-h-screen items-center justify-center text-slate-500">
          Cargando sesión…
        </div>
      );
    }
    if (marketing) {
      redirectToApp(firstAccessibleRoute(user));
      return (
        <div className="flex min-h-screen items-center justify-center text-slate-500">
          Redirigiendo a la app…
        </div>
      );
    }
    return <Navigate to={firstAccessibleRoute(user)} replace />;
  }

  const openLogin = () => {
    if (marketing) {
      window.location.href = `${APP_ORIGIN}/login`;
      return;
    }
    setLoginOpen(true);
  };

  return (
    <>
      <ShowcasePage onLoginClick={openLogin} />
      {!marketing && <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />}
    </>
  );
}
