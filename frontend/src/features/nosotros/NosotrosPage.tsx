import { useEffect } from "react";
import { Link } from "react-router-dom";
import ShowcaseIcon from "../showcase/ShowcaseIcon";
import ShowcaseLogo from "../showcase/ShowcaseLogo";
import { contactWhatsApp, CONTACT_EMAIL, CONTACT_PHONE } from "@/features/showcase/showcaseData";
import { reveal, revealCycle, revealUseCase } from "../showcase/revealVariants";
import { useScrollReveal } from "../showcase/useScrollReveal";
import "../showcase/showcase.scss";
import "./nosotros.scss";

function Si({ icon, className, size = 20 }: { icon: string; className?: string; size?: number }) {
  return <ShowcaseIcon icon={icon} className={className} size={size} />;
}

const expertise = [
  { icon: "fas fa-code", label: "Ingeniería de software" },
  { icon: "fas fa-network-wired", label: "Infraestructura" },
  { icon: "fas fa-user-tie", label: "Consultoría TI" },
  { icon: "fas fa-cloud", label: "Cloud & DevOps" },
];

const objectives = [
  {
    icon: "fas fa-lightbulb",
    color: "#1a5f8c",
    title: "Innovación",
    text: "Soluciones actuales para necesidades reales del sector público.",
  },
  {
    icon: "fas fa-shield-alt",
    color: "#b45309",
    title: "Seguridad",
    text: "Ciberseguridad y cumplimiento normativo (MIPG, Gobierno Digital).",
  },
  {
    icon: "fas fa-handshake",
    color: "#0f766e",
    title: "Acompañamiento",
    text: "Soporte técnico y transferencia de conocimiento a largo plazo.",
  },
  {
    icon: "fas fa-chart-line",
    color: "#1d4ed8",
    title: "Sostenibilidad",
    text: "Eficiencia en proyectos y capacitación continua del equipo.",
  },
];

const values = [
  {
    icon: "fas fa-database",
    title: "Decisiones con datos",
    text: "Herramientas que capturan y analizan información en tiempo real.",
  },
  {
    icon: "fas fa-balance-scale",
    title: "Transparencia",
    text: "Procesos claros alineados con Gobierno Digital y MIPG.",
  },
  {
    icon: "fas fa-map-marked-alt",
    title: "Seguimiento al plan",
    text: "Monitoreo del avance del PDM y metas institucionales.",
  },
];

export default function NosotrosPage() {
  useScrollReveal(".nos-page");

  useEffect(() => {
    document.body.classList.add("showcase-active");
    return () => {
      document.body.classList.remove("showcase-active");
    };
  }, []);

  return (
    <div className="nos-page">
      <section className="sc-hero nos-hero">
        <div className="sc-hero-glow sc-hero-glow--primary" aria-hidden="true" />
        <div className="sc-hero-glow sc-hero-glow--accent" aria-hidden="true" />
        <div className="sc-hero-grid" aria-hidden="true" />
        <div className="container">
          <div className="sc-hero-header">
            <Link to="/" className="sc-hero-back">
              <Si icon="fas fa-arrow-left" size={14} />
              Inicio
            </Link>
            <Link to="/" className="sc-hero-brand" aria-label="SoftOne360 inicio">
              <ShowcaseLogo size={48} className="sc-hero-brand-logo" />
              <span className="sc-hero-brand-text">
                <strong>SoftOne360</strong>
                <small>Gestión estratégica, visión total</small>
              </span>
            </Link>
          </div>

          <div className="nos-hero-inner">
            <div className={`nos-hero-main ${reveal.left}`}>
              <p className="sc-eyebrow">
                <Si icon="fas fa-building" size={14} />
                Nuestra empresa
              </p>
              <h1 className="sc-hero-title nos-hero-title">
                Arquitectos de{" "}
                <span className="sc-hero-highlight">soluciones digitales</span>
              </h1>
              <p className="sc-hero-lead">
                Tecnología de vanguardia para organizaciones del sector público colombiano —
                con enfoque 360° en eficiencia, datos y cumplimiento.
              </p>
              <div className="nos-pill-row">
                {expertise.map((item) => (
                  <span key={item.label} className="nos-pill">
                    <Si icon={item.icon} size={14} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className={`nos-hero-aside ${reveal.right}`}>
              <article className="nos-mv-card nos-mv-mission">
                <div className="nos-mv-icon">
                  <Si icon="fas fa-rocket" size={20} />
                </div>
                <div>
                  <p className="nos-mv-label">Misión</p>
                  <p className="nos-mv-text">
                    Impulsar la evolución digital con soluciones integrales, seguras y escalables.
                  </p>
                </div>
              </article>
              <article className="nos-mv-card nos-mv-vision">
                <div className="nos-mv-icon">
                  <Si icon="fas fa-eye" size={20} />
                </div>
                <div>
                  <p className="nos-mv-label">Visión 2030</p>
                  <p className="nos-mv-text">
                    Ser el aliado tecnológico referente en gestión digital inteligente del sector
                    público y privado.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="sc-section nos-intro">
        <div className="container">
          <div className={`sc-section-head text-center ${reveal.clip}`}>
            <h2 className="sc-section-title">Quiénes somos</h2>
            <p className="sc-section-lead">
              Cerramos la brecha entre los desafíos operativos y las posibilidades tecnológicas.
            </p>
          </div>
          <p className={`nos-body nos-body-centered ${reveal.fade}`}>
            En <strong>SoftOne360</strong> integramos ingeniería de sistemas, infraestructura y
            consultoría para ofrecer una visión <strong>360°</strong> alineada con las exigencias
            del Estado colombiano. No solo construimos software: entregamos claridad para gobernar
            con precisión.
          </p>
        </div>
      </section>

      <section className="sc-section sc-section-alt">
        <div className="container">
          <div className={`sc-section-head text-center ${reveal.down}`}>
            <h2 className="sc-section-title">Objetivos corporativos</h2>
            <p className="sc-section-lead">Los pilares que guían cada proyecto.</p>
          </div>
          <div className="sc-cards-grid sc-cards-grid--benefits">
            {objectives.map((obj, i) => (
              <article
                key={obj.title}
                className={`sc-benefit nos-obj-card ${revealCycle(i)}`}
                style={{ ["--module-color" as string]: obj.color }}
              >
                <div className="nos-obj-icon">
                  <Si icon={obj.icon} size={22} />
                </div>
                <h3 className="sc-benefit-title">{obj.title}</h3>
                <p className="sc-benefit-text">{obj.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-dark nos-intel">
        <div className="container">
          <div className={`sc-section-head text-center ${reveal.fade}`}>
            <h2 className="sc-section-title sc-section-title-light">
              Gestión pública con datos
            </h2>
            <p className="sc-section-lead sc-section-lead-light">
              Cómo transformamos la tecnología en progreso visible para las comunidades.
            </p>
          </div>
          <div className="sc-cards-grid sc-cards-grid--cases">
            {values.map((item, i) => (
              <article key={item.title} className={`nos-intel-item ${revealUseCase(i)}`}>
                  <div className="nos-intel-icon">
                    <Si icon={item.icon} size={18} />
                  </div>
                  <div>
                    <h3 className="nos-intel-title">{item.title}</h3>
                    <p className="nos-intel-text">{item.text}</p>
                  </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section nos-cta-wrap">
        <div className="container">
          <div className={`sc-cta ${reveal.clip}`}>
            <div className="sc-cta-content">
              <h2 className="sc-cta-title">¿Hablamos de su entidad?</h2>
              <p className="sc-cta-text">
                Agende una demo o escríbanos por WhatsApp.
              </p>
            </div>
            <div className="nos-cta-actions">
              <button
                type="button"
                className="sc-btn sc-btn-light sc-btn-lg"
                onClick={() => contactWhatsApp("Hola, quiero agendar una demo de SoftOne360.")}
              >
                <Si icon="fab fa-whatsapp" size={18} />
                Solicitar demo
              </button>
              <Link to="/" className="sc-btn sc-btn-ghost sc-btn-lg nos-cta-outline">
                <Si icon="fas fa-home" size={16} />
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="sc-footer">
        <div className="container">
          <div className={`sc-footer-main ${reveal.fade}`}>
            <div className="sc-footer-col sc-footer-col-brand">
              <div className="sc-footer-brand">
                <ShowcaseLogo size={44} className="sc-footer-logo" />
                <div>
                  <strong>SoftOne360</strong>
                  <span>Gestión estratégica, visión total</span>
                </div>
              </div>
              <p className="sc-footer-about">
                Gestión pública territorial con IA, informes y módulos integrados.
              </p>
            </div>

            <div className="sc-footer-col sc-footer-col-links">
              <h6 className="sc-footer-heading">Enlaces</h6>
              <nav className="sc-footer-nav" aria-label="Enlaces del sitio">
                <Link to="/#pdm-destacado" className="sc-footer-link">
                  PDM 360°
                </Link>
                <Link to="/#features" className="sc-footer-link">
                  Capacidades
                </Link>
                <Link to="/#modules" className="sc-footer-link">
                  Módulos
                </Link>
                <Link to="/#contact" className="sc-footer-link">
                  Contacto
                </Link>
                <Link to="/nosotros" className="sc-footer-link">
                  Nosotros
                </Link>
              </nav>
            </div>

            <div className="sc-footer-col sc-footer-col-contact">
              <h6 className="sc-footer-heading">Contacto</h6>
              <ul className="sc-footer-contact">
                <li>
                  <Si icon="fas fa-envelope" size={16} />
                  <a href={`mailto:${CONTACT_EMAIL}`} className="sc-footer-contact-link">
                    {CONTACT_EMAIL}
                  </a>
                </li>
                <li>
                  <Si icon="fas fa-phone" size={16} />
                  <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`} className="sc-footer-contact-link">
                    {CONTACT_PHONE}
                  </a>
                </li>
                <li>
                  <Si icon="fas fa-map-marker-alt" size={16} />
                  <span>Tunja, Boyacá — Colombia</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="sc-footer-bottom">
            <p>© 2026 SoftOne360 · PDM 360° · React + Django + PostgreSQL</p>
            <p>Desarrollado en Tunja, Boyacá</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
