import { Navigate, useLocation } from "react-router-dom";
import { SignIn, useAuth } from "@clerk/react";
import { useAuthStore, homeForRole } from "@/core/auth/store";

export default function LoginPage() {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  if (isLoaded && isSignedIn && user) {
    return <Navigate to={from || homeForRole(user)} replace />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <span className="text-xl font-bold">S1</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">SoftOne</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Gestiona tu operación
              <br /> con una sola plataforma.
            </h1>
            <p className="mt-4 max-w-md text-white/80">
              Acceso seguro, control por roles y todo lo que tu equipo necesita en un
              solo lugar.
            </p>
          </div>
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} SoftOne 360 · app.softone360.com
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 w-full max-w-md lg:hidden">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
              <span className="font-bold">S1</span>
            </div>
            <span className="text-xl font-semibold text-slate-900">SoftOne</span>
          </div>
        </div>
        <div className="flex w-full max-w-md justify-center">
          <SignIn
            routing="path"
            path="/login"
            forceRedirectUrl={from || "/"}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border border-slate-200 rounded-xl w-full",
                footerAction: { display: "none" },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
