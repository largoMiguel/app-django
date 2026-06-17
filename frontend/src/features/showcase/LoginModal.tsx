import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SignIn } from "@clerk/react";
import { MapPinned, ShieldCheck, X } from "lucide-react";
import ShowcaseLogo from "./ShowcaseLogo";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const MODULES = ["PDM 360°", "PQRS", "Contratación", "Informes PDF"];

const HIGHLIGHTS = [
  { icon: MapPinned, text: "Seguimiento del PDM cuatrienal con informes y dashboards" },
  { icon: ShieldCheck, text: "Roles y permisos por entidad, secretaría y módulo" },
];

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

  const isDevClerk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_");

  return createPortal(
    <div className="login-shell" onClick={onClose} role="presentation">
      <div
        className="login-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-dialog-title"
      >
        <aside className="login-dialog-brand">
          <button
            type="button"
            className="login-dialog-close login-dialog-close-mobile"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>

          <div className="login-dialog-brand-grid" aria-hidden="true" />

          <div className="login-dialog-brand-content">
            <h2 id="login-dialog-title" className="login-dialog-heading">
              Gestión Pública <span className="login-dialog-accent">360°</span> con
              Inteligencia Artificial
            </h2>
            <p className="login-dialog-lead">
              PDM, PQRS, contratación e informes ejecutivos en una sola plataforma para su
              entidad.
            </p>

            <div className="login-dialog-modules">
              {MODULES.map((mod) => (
                <span key={mod} className="login-dialog-module-chip">
                  {mod}
                </span>
              ))}
            </div>

            <ul className="login-dialog-highlights">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span className="login-dialog-highlight-icon">
                    <Icon size={18} />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="login-dialog-brand-watermark" aria-hidden="true">
            360°
          </div>
        </aside>

        <section className="login-dialog-form">
          <div className="login-dialog-mobile-brand">
            <ShowcaseLogo size={32} />
            <strong>SoftOne360</strong>
          </div>

          <div className="login-dialog-form-header">
            <div>
              <h3 className="login-dialog-form-title">Ingresar al sistema</h3>
              <p className="login-dialog-form-sub">Correo autorizado por su entidad</p>
            </div>
            <button type="button" className="login-dialog-close" onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>

          <div className="login-dialog-clerk-wrap">
            <div className="login-dialog-form-logo">
              <ShowcaseLogo size={56} />
              <strong>SoftOne360</strong>
            </div>

            <div className="login-dialog-clerk">
              <SignIn
                forceRedirectUrl="/"
                appearance={{
                  elements: {
                    rootBox: "login-clerk-root",
                    cardBox: "login-clerk-card-box",
                    card: "login-clerk-card",
                    logoBox: { display: "none" },
                    logoImage: { display: "none" },
                    header: "hidden",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton:
                      "border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 rounded-xl h-11 shadow-sm",
                    dividerLine: "bg-slate-200",
                    dividerText: "text-slate-400 text-xs",
                    formFieldLabel: "text-slate-700 font-semibold text-sm",
                    formFieldInput:
                      "rounded-xl border-slate-200 focus:border-[#1a5f8c] focus:ring-2 focus:ring-[#1a5f8c]/15 h-11 transition-all duration-200",
                    formButtonPrimary:
                      "rounded-xl bg-[#1a5f8c] hover:bg-[#134466] text-sm font-semibold h-11 shadow-md hover:shadow-lg transition-all duration-200",
                    footer: "hidden",
                    footerAction: { display: "none" },
                    identityPreview: "rounded-xl border border-slate-200",
                    formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-600",
                  },
                }}
              />
            </div>
            {isDevClerk && (
              <p className="login-clerk-dev-badge" role="status">
                Entorno de desarrollo Clerk (pk_test)
              </p>
            )}
          </div>

          <p className="login-dialog-footnote">
            <ShieldCheck size={14} />
            Conexión protegida · Solo usuarios autorizados por su entidad
          </p>
        </section>
      </div>
    </div>,
    document.body,
  );
}
