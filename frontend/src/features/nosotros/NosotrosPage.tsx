import { useEffect } from "react";
import { Link } from "react-router-dom";
import ShowcaseIcon from "../showcase/ShowcaseIcon";
import ShowcaseNav from "../showcase/ShowcaseNav";
import ShowcaseLogo from "../showcase/ShowcaseLogo";
import { contactWhatsApp, CONTACT_EMAIL, CONTACT_PHONE } from "@/features/showcase/showcaseData";
import { useScrollReveal } from "../showcase/useScrollReveal";
import "../showcase/showcase.scss";
import "./nosotros.scss";

function Si({ icon, className, size = 20 }: { icon: string; className?: string; size?: number }) {
  return <ShowcaseIcon icon={icon} className={className} size={size} />;
}

const pills = [
  { icon: "fas fa-code", label: "Ingeniería de Software" },
  { icon: "fas fa-network-wired", label: "Infraestructura de Redes" },
  { icon: "fas fa-user-tie", label: "Consultoría TI" },
  { icon: "fas fa-cloud", label: "Cloud & DevOps" },
];

const objectives = [
  {
    icon: "fas fa-lightbulb",
    color: "#1a5f8c",
    title: "Innovación Continua",
    text: "Desarrollar y desplegar soluciones de software con las últimas tendencias tecnológicas para resolver necesidades emergentes del mercado.",
  },
  {
    icon: "fas fa-network-wired",
    color: "#15803d",
    title: "Excelencia en Infraestructura",
    text: "Garantizar la continuidad del negocio de nuestros aliados mediante el diseño y mantenimiento de redes y sistemas de alta disponibilidad.",
  },
  {
    icon: "fas fa-shield-alt",
    color: "#b45309",
    title: "Seguridad y Cumplimiento",
    text: "Implementar protocolos de ciberseguridad y estándares técnicos que aseguren la integridad de la información y el cumplimiento normativo (MIPG, Gobierno Digital).",
  },
  {
    icon: "fas fa-handshake",
    color: "#0f766e",
    title: "Fidelización Estratégica",
    text: "Establecer relaciones de confianza a largo plazo basadas en soporte técnico especializado, transferencia de conocimiento y optimización de la inversión tecnológica.",
  },
  {
    icon: "fas fa-chart-line",
    color: "#1d4ed8",
    title: "Sostenibilidad Operativa",
    text: "Mantener un crecimiento constante mediante la eficiencia en la ejecución de proyectos y la capacitación continua de nuestro talento humano.",
  },
];

const intelItems = [
  {
    icon: "fas fa-database",
    title: "Decisiones Basadas en Evidencia",
    text: "Empoderamos a las instituciones con herramientas que capturan, procesan y analizan datos reales en tiempo real, garantizando que cada decisión estratégica esté respaldada por información precisa.",
  },
  {
    icon: "fas fa-balance-scale",
    title: "Transparencia, Eficiencia y Progreso",
    text: "Optimizamos los procesos institucionales con enfoque en el bienestar del ciudadano, facilitando el cumplimiento de Gobierno Digital y el modelo MIPG.",
  },
  {
    icon: "fas fa-map-marked-alt",
    title: "Seguimiento al Plan de Desarrollo",
    text: "Herramientas que monitorean el avance de metas y programas de gobierno, transformando la planeación administrativa en progreso visible para las comunidades.",
  },
  {
    icon: "fas fa-tachometer-alt",
    title: "Visibilidad de Indicadores en Tiempo Real",
    text: "Tableros de control que exponen indicadores de cumplimiento de cara al ciudadano, fortaleciendo la transparencia y permitiendo una rendición de cuentas dinámica.",
  },
  {
    icon: "fas fa-users",
    title: "Administración Cercana y Ágil",
    text: "Al automatizar la medición del impacto social, logramos que la administración pública sea más eficiente, reduciendo brechas y garantizando que los recursos tecnológicos se traduzcan en mejor calidad de vida.",
  },
  {
    icon: "fas fa-seedling",
    title: "Impacto Social Sostenible",
    text: "Convertimos la infraestructura técnica en progreso tangible. Al mejorar la calidad de datos y velocidad de procesos, maximizamos el impacto positivo de las políticas públicas.",
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
      <ShowcaseNav
        items={[
          { type: "link", to: "/", label: "Inicio" },
          { type: "current", label: "Nosotros" },
        ]}
        cta={
          <Link to="/" className="sc-btn sc-btn-primary sc-nav-cta">
            <Si icon="fas fa-home" size={16} />
            Volver al inicio
          </Link>
        }
      />

      <section className="sc-hero nos-hero">
        <div className="sc-hero-grid" aria-hidden="true" />
        <div className="container">
          <div className="nos-hero-content">
            <p className="sc-eyebrow">
              <Si icon="fas fa-building" size={14} />
              Nuestra empresa
            </p>
            <h1 className="sc-hero-title nos-hero-title">
              Arquitectos de{" "}
              <span className="sc-hero-highlight">soluciones digitales</span>
            </h1>
            <p className="sc-hero-lead">
              Transformamos organizaciones con tecnología de vanguardia, estrategia y propósito
              orientado al sector público colombiano.
            </p>
            <div className="nos-pill-row">
              {pills.map((pill) => (
                <span key={pill.label} className="nos-pill">
                  <Si icon={pill.icon} size={14} />
                  {pill.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sc-section nos-intro">
        <div className="container">
          <div className="sc-section-head text-center animate">
            <span className="sc-chip">
              <Si icon="fas fa-compass" size={14} />
              Quiénes somos
            </span>
            <h2 className="sc-section-title">Conoce SoftOne360</h2>
            <p className="sc-section-lead">
              Una empresa creada para llevar la transformación digital al corazón de las
              organizaciones.
            </p>
          </div>
          <div className="row align-items-start g-5">
            <div className="col-lg-6 animate">
              <p className="nos-body">
                En <strong>SoftOne360</strong>, somos arquitectos de soluciones digitales
                dedicados a potenciar la eficiencia organizacional mediante la integración
                estratégica de tecnología de última generación. Nuestra razón de ser es cerrar la
                brecha entre los desafíos operativos y las posibilidades tecnológicas,
                consolidándonos como el aliado estratégico de quienes buscan una{" "}
                <strong>transformación cultural y funcional</strong>.
              </p>
              <p className="nos-body">
                Nuestro equipo multidisciplinario, experto en ingeniería de sistemas,
                infraestructura de redes y consultoría administrativa, nos permite ofrecer una
                perspectiva integral <strong>360°</strong> alineada con las exigencias normativas
                del Estado.
              </p>
              <div className="nos-badge-row">
                {pills.map((pill) => (
                  <span key={pill.label} className="nos-badge">
                    <Si icon={pill.icon} size={14} />
                    {pill.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="col-lg-6 animate">
              <article className="nos-mv-card nos-mv-mission">
                <div className="nos-mv-icon">
                  <Si icon="fas fa-rocket" size={20} />
                </div>
                <div>
                  <p className="nos-mv-label">Misión</p>
                  <p className="nos-mv-text">
                    Impulsar la evolución digital de las organizaciones a través de soluciones
                    tecnológicas integrales y personalizadas, garantizando seguridad, escalabilidad
                    y competitividad.
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
                    Consolidarnos como el aliado tecnológico referente en el sector público y
                    privado, liderando la transición hacia modelos de{" "}
                    <strong>Gestión Digital Inteligente</strong>.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-alt nos-objectives">
        <div className="container">
          <div className="sc-section-head text-center animate">
            <span className="sc-chip">Objetivos</span>
            <h2 className="sc-section-title">Objetivos corporativos</h2>
            <p className="sc-section-lead">
              Los cinco pilares que guían cada decisión y proyecto en SoftOne360.
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {objectives.map((obj, i) => (
              <div
                key={obj.title}
                className={`animate ${i >= 3 ? "col-md-6" : "col-md-6 col-lg-4"}`}
              >
                <article className="sc-benefit nos-obj-card" style={{ ["--module-color" as string]: obj.color }}>
                  <div className="nos-obj-icon">
                    <Si icon={obj.icon} size={22} />
                  </div>
                  <h3 className="sc-benefit-title">{obj.title}</h3>
                  <p className="sc-benefit-text">{obj.text}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-dark nos-intel">
        <div className="container">
          <div className="sc-section-head text-center animate">
            <span className="sc-chip sc-chip-light">
              <Si icon="fas fa-brain" size={14} />
              Sector público
            </span>
            <h2 className="sc-section-title sc-section-title-light">
              Inteligencia estratégica para la gestión pública
            </h2>
            <p className="sc-section-lead sc-section-lead-light">
              Soluciones diseñadas para revolucionar la gestión pública con datos, transparencia y
              agilidad institucional.
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {intelItems.map((item) => (
              <div key={item.title} className="col-md-6 animate">
                <article className="nos-intel-item">
                  <div className="nos-intel-icon">
                    <Si icon={item.icon} size={18} />
                  </div>
                  <div>
                    <h3 className="nos-intel-title">{item.title}</h3>
                    <p className="nos-intel-text">{item.text}</p>
                  </div>
                </article>
              </div>
            ))}
          </div>
          <blockquote className="nos-intel-quote animate">
            En SoftOne360, no solo construimos sistemas; entregamos la claridad técnica necesaria
            para gobernar con precisión y proyectar a las organizaciones hacia un futuro sostenible.
          </blockquote>
        </div>
      </section>

      <section className="sc-section nos-cta-wrap">
        <div className="container">
          <div className="sc-cta animate">
            <div className="sc-cta-content">
              <h2 className="sc-cta-title">¿Listo para transformar su organización?</h2>
              <p className="sc-cta-text">
                Hablemos sobre cómo SoftOne360 puede impulsar su entidad hacia la gestión digital
                inteligente.
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
          <div className="sc-footer-main animate">
            <div className="sc-footer-col sc-footer-col-brand">
              <div className="sc-footer-brand">
                <ShowcaseLogo size={44} className="sc-footer-logo" />
                <div>
                  <strong>SoftOne360</strong>
                  <span>Gestión estratégica, visión total</span>
                </div>
              </div>
              <p className="sc-footer-about">
                Plataforma integral de gestión pública con IA generativa, analytics avanzado y
                cumplimiento normativo.
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
