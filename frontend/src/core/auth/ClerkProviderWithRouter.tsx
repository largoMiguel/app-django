import { ClerkProvider } from "@clerk/react";
import { esES } from "@clerk/localizations";
import { ui } from "@clerk/ui";
import { useNavigate } from "react-router-dom";
import { getClerkDomain, isClerkConfigured } from "@/core/auth/clerkConfig";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!isClerkConfigured() && !import.meta.env.DEV) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

export default function ClerkProviderWithRouter({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isClerkConfigured()) {
    if (import.meta.env.DEV) {
      console.warn(
        "VITE_CLERK_PUBLISHABLE_KEY no está definida — la home pública funciona; el login requiere la clave.",
      );
    }
    return <>{children}</>;
  }

  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      ui={ui}
      domain={getClerkDomain()}
      localization={esES}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}
