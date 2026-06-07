import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import ShowcaseIcon from "./ShowcaseIcon";

interface ShowcaseNavProps {
  onLoginClick: () => void;
  onNavigate: (sectionId: string) => void;
}

const NAV_LINKS = [
  { id: "pdm-destacado", label: "PDM 360°" },
  { id: "features", label: "Capacidades" },
  { id: "modules", label: "Módulos" },
  { id: "contact", label: "Contacto" },
];

export default function ShowcaseNav({ onLoginClick, onNavigate }: ShowcaseNavProps) {
  return (
    <header className="showcase-nav">
      <div className="showcase-nav-inner">
        <a href="#" className="showcase-nav-brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <span className="showcase-brand-mark">S1</span>
          <div>
            <span className="showcase-nav-title">SoftOne360</span>
            <span className="showcase-nav-tagline">Gestión Pública 360°</span>
          </div>
        </a>

        <nav className="showcase-nav-links" aria-label="Secciones principales">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className="showcase-nav-link"
              onClick={() => onNavigate(link.id)}
            >
              {link.label}
            </button>
          ))}
          <Link to="/nosotros" className="showcase-nav-link showcase-nav-link-muted">
            Nosotros
          </Link>
        </nav>

        <button type="button" className="showcase-nav-cta" onClick={onLoginClick}>
          <LogIn size={18} strokeWidth={2.5} />
          <span>Ingresar</span>
        </button>
      </div>
    </header>
  );
}

export function HeroFeatureStrip() {
  const items = [
    { icon: "fas fa-map-marked-alt", label: "PDM 360°", color: "#216ba8" },
    { icon: "fas fa-brain", label: "IA OpenAI", color: "#7c3aed" },
    { icon: "fas fa-file-pdf", label: "Informes PDF", color: "#e74a3b" },
    { icon: "fas fa-shield-alt", label: "Acceso seguro", color: "#f59e0b" },
    { icon: "fas fa-users", label: "Multi-entidad", color: "#059669" },
  ];

  return (
    <div className="hero-mobile-strip d-lg-none">
      {items.map((item) => (
        <div key={item.label} className="hero-mobile-chip">
          <span className="hero-mobile-chip-icon" style={{ background: item.color }}>
            <ShowcaseIcon icon={item.icon} size={16} className="text-white" />
          </span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
