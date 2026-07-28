import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { SignIn, useAuth } from "@clerk/react";
import { Moon, Sun } from "lucide-react";
import SessionLoadingScreen from "@/components/ui/SessionLoadingScreen";
import { consumeAuthBlockMessage } from "@/core/auth/authErrors";
import { canAccessPath, firstAccessibleRoute } from "@/core/auth/routes";
import { useAuthStore } from "@/core/auth/store";

const loginAppearance = (dark: boolean) => ({
  variables: {
    colorPrimary: "#3eafd4",
    colorText: dark ? "#e2e8f0" : "#1e293b",
    colorBackground: dark ? "#1e293b" : "#ffffff",
    colorInputBackground: dark ? "#0f172a" : "#f0f9ff",
    colorInputText: dark ? "#f8fafc" : "#0f172a",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none w-full",
    card: `shadow-lg border ${dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"} rounded-xl w-full overflow-hidden`,
    headerTitle: "text-xl font-bold",
    headerSubtitle: "text-sm",
    formButtonPrimary:
      "bg-[#3eafd4] hover:bg-[#2f9fc2] text-white font-semibold rounded-lg shadow-none normal-case",
    formFieldInput: `rounded-lg border ${dark ? "border-slate-600" : "border-slate-200"}`,
    footerAction: { display: "none" },
    identityPreviewEditButton: { color: "#3eafd4" },
  },
});

export default function LoginPage() {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setBlockMessage(consumeAuthBlockMessage());
  }, []);

  if (!isLoaded) {
    return <SessionLoadingScreen message="Iniciando…" />;
  }

  if (isSignedIn && !user) {
    return <SessionLoadingScreen />;
  }

  if (isSignedIn && user) {
    const destination =
      from && canAccessPath(user, from) ? from : firstAccessibleRoute(user);
    return <Navigate to={destination} replace />;
  }

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center px-4 py-10 transition-colors ${
        dark ? "bg-slate-900" : "bg-[#f4f6f8]"
      }`}
    >
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#3eafd4] text-sm font-bold text-white">
            S1
          </div>
          <span className={`text-xl font-semibold ${dark ? "text-white" : "text-slate-800"}`}>
            SoftOne <strong>360</strong>
          </span>
        </div>
      </div>

      <div className="w-full max-w-md">
        {blockMessage && (
          <div
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            {blockMessage}
          </div>
        )}

        <div className={`rounded-xl p-1 ${dark ? "" : ""}`}>
          <SignIn
            routing="path"
            path="/login"
            appearance={loginAppearance(dark)}
          />
        </div>
      </div>

      <footer
        className={`mt-10 flex items-center gap-3 text-xs ${
          dark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <span>© {new Date().getFullYear()} | Powered by SoftOne 360</span>
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          className={`inline-flex items-center rounded-md p-1.5 transition ${
            dark ? "hover:bg-slate-800" : "hover:bg-slate-200"
          }`}
          aria-label={dark ? "Modo claro" : "Modo oscuro"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </footer>
    </div>
  );
}
