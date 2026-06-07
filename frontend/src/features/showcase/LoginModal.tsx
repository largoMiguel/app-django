import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SignIn } from "@clerk/react";
import { LogIn, ShieldCheck, Sparkles, X } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const HIGHLIGHTS = [
  { icon: Sparkles, text: "PDM, PQRS y contratación en una sola plataforma" },
  { icon: ShieldCheck, text: "Acceso seguro con roles por entidad y secretaría" },
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
          <div className="login-dialog-brand-content">
            <p className="login-dialog-eyebrow">SoftOne360</p>
            <h2 id="login-dialog-title" className="login-dialog-heading">
              Tu entidad, un solo lugar para gestionar
            </h2>
            <p className="login-dialog-lead">
              Ingresa con tu cuenta institucional para acceder al PDM, PQRS, informes y módulos
              habilitados para tu organización.
            </p>
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
        </aside>

        <section className="login-dialog-form">
          <div className="login-dialog-mobile-brand">
            <div>
              <strong>SoftOne360</strong>
              <span>Acceso institucional seguro</span>
            </div>
          </div>

          <div className="login-dialog-form-header">
            <div className="login-dialog-form-title-wrap">
              <span className="login-dialog-form-icon">
                <LogIn size={20} />
              </span>
              <div>
                <h3 className="login-dialog-form-title">Ingresar al sistema</h3>
                <p className="login-dialog-form-sub">Use su correo institucional autorizado</p>
              </div>
            </div>
            <button type="button" className="login-dialog-close" onClick={onClose} aria-label="Cerrar">
              <X size={20} />
            </button>
          </div>

          <div className="login-dialog-clerk">
            <SignIn
              forceRedirectUrl="/"
              appearance={{
                elements: {
                  rootBox: "login-clerk-root",
                  cardBox: "login-clerk-card-box",
                  card: "login-clerk-card",
                  logoBox: "hidden",
                  logoImage: "hidden",
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
