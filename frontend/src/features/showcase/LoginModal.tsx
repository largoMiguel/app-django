import { SignIn } from "@clerk/react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay login-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="login-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <div className="login-modal-header">
          <div>
            <h3 id="login-modal-title" className="login-modal-title">
              <i className="fas fa-sign-in-alt me-2" />
              Ingresar al Sistema
            </h3>
            <p className="login-modal-sub">Acceso seguro con su cuenta institucional</p>
          </div>
          <button type="button" className="login-modal-close" onClick={onClose} aria-label="Cerrar">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="login-modal-body">
          <SignIn
            forceRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full mx-auto",
                card: "shadow-none border-0 w-full p-0",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                footerAction: { display: "none" },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
