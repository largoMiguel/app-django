import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { isClerkConfigured } from "@/core/auth/clerkConfig";
import { firstAccessibleRoute } from "@/core/auth/routes";
import { useAuthStore } from "@/core/auth/store";
import LoginModal from "./LoginModal";
import ShowcasePage from "./ShowcasePage";
import "./showcase.scss";

function SignedInRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);

  if (!isLoaded || !isSignedIn || !user) return null;
  return <Navigate to={firstAccessibleRoute(user)} replace />;
}

export default function HomePage() {
  const location = useLocation();
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

  return (
    <>
      {isClerkConfigured() && <SignedInRedirect />}
      <ShowcasePage onLoginClick={() => setLoginOpen(true)} />
      {isClerkConfigured() && (
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </>
  );
}
