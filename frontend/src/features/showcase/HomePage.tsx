import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { firstAccessibleRoute } from "@/core/auth/routes";
import { useAuthStore } from "@/core/auth/store";
import LoginModal from "./LoginModal";
import ShowcasePage from "./ShowcasePage";

export default function HomePage() {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("showcase-active");
    return () => {
      document.body.classList.remove("showcase-active");
    };
  }, []);

  useEffect(() => {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from;
    if (from?.pathname) {
      setLoginOpen(true);
    }
  }, [location.state]);

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
    return <Navigate to={firstAccessibleRoute(user)} replace />;
  }

  return (
    <>
      <ShowcasePage onLoginClick={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
