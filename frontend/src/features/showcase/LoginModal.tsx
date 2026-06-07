import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SignIn } from "@clerk/react";
import { ShieldCheck, X } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="login-shell" onClick={onClose} role="presentation">
      <div
        className="login-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-card-title"
      >
        <header className="login-card-header">
          <div>
            <p className="login-card-eyebrow">SoftOne360</p>
            <h2 id="login-card-title" className="login-card-title">
              Ingresar al sistema
            </h2>
            <p className="login-card-sub">Use su cuenta institucional autorizada</p>
          </div>
          <button type="button" className="login-card-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="login-card-body">
          <SignIn
            forceRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full mx-auto",
                cardBox: "w-full shadow-none",
                card: "shadow-none border-0 bg-transparent p-0 gap-4 w-full",
                header: "hidden",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "border-slate-200 hover:bg-slate-50 transition-colors rounded-xl h-11",
                dividerLine: "bg-slate-200",
                dividerText: "text-slate-400 text-xs",
                formFieldLabel: "text-slate-700 font-medium text-sm",
                formFieldInput:
                  "rounded-xl border-slate-200 focus:border-[#216ba8] focus:ring-[#216ba8]/20 h-11",
                formButtonPrimary:
                  "rounded-xl bg-[#216ba8] hover:bg-[#1a5a8f] text-sm font-semibold h-11 shadow-sm",
                footer: "hidden",
                footerAction: { display: "none" },
                identityPreview: "rounded-xl border border-slate-200",
              },
              layout: {
                socialButtonsPlacement: "top",
                showOptionalFields: false,
              },
            }}
          />
        </div>

        <p className="login-card-footnote">
          <ShieldCheck size={14} />
          Conexión protegida · Solo usuarios autorizados por su entidad
        </p>
      </div>
    </div>,
    document.body,
  );
}
