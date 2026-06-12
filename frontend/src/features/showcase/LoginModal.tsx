import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SignIn } from "@clerk/react";
import { ShieldCheck, X } from "lucide-react";
import ShowcaseLogo from "./ShowcaseLogo";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const EXIT_MS = 200;

function usePrefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reducedMotion) {
        setVisible(true);
        return;
      }
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open, reducedMotion]);

  useEffect(() => {
    if (visible || !mounted) return undefined;
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [visible, mounted]);

  const requestClose = useCallback(() => {
    if (reducedMotion) {
      setMounted(false);
      onClose();
      return;
    }
    setVisible(false);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose, reducedMotion]);

  useEffect(() => {
    if (!mounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, requestClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="login-shell"
      data-visible={visible}
      onClick={requestClose}
      role="presentation"
    >
      <div
        className="login-dialog"
        data-visible={visible}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-dialog-title"
      >
        <aside className="login-dialog-brand" data-visible={visible}>
          <div className="login-dialog-brand-grid" aria-hidden="true" />
          <button
            type="button"
            className="login-dialog-close login-dialog-close-mobile"
            onClick={requestClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          <div className="login-dialog-brand-content">
            <ShowcaseLogo size={88} className="login-dialog-logo" />
            <div className="login-dialog-brand-copy">
              <p className="login-dialog-eyebrow">Acceso institucional</p>
              <h2 id="login-dialog-title" className="login-dialog-heading">
                Gestión pública con visión total
              </h2>
              <p className="login-dialog-lead">
                PDM, PQRS e informes en una plataforma segura, diseñada para entidades
                territoriales en Colombia.
              </p>
            </div>
            <p className="login-dialog-trust">
              <ShieldCheck size={14} aria-hidden="true" />
              Conexión cifrada · Solo usuarios autorizados
            </p>
          </div>
        </aside>

        <section className="login-dialog-form">
          <div className="login-dialog-mobile-brand">
            <ShowcaseLogo size={40} />
            <div>
              <strong>SoftOne360</strong>
              <span>Acceso institucional</span>
            </div>
          </div>

          <div className="login-dialog-form-header">
            <div>
              <h3 className="login-dialog-form-title">Ingresar</h3>
              <p className="login-dialog-form-sub">Correo institucional autorizado</p>
            </div>
            <button type="button" className="login-dialog-close" onClick={requestClose} aria-label="Cerrar">
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
                  socialButtonsBlockButton: "login-clerk-social",
                  dividerLine: "bg-slate-200",
                  dividerText: "text-slate-400 text-xs",
                  formFieldLabel: "text-slate-700 font-medium text-sm",
                  formFieldInput: "login-clerk-input",
                  formButtonPrimary: "login-clerk-submit",
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
        </section>
      </div>
    </div>,
    document.body,
  );
}
