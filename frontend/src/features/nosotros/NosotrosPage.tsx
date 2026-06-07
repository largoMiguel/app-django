import { useEffect } from "react";
import ShowcaseIcon from "../showcase/ShowcaseIcon";

function Si({ icon, className, size = 20 }: { icon: string; className?: string; size?: number }) {
  return <ShowcaseIcon icon={icon} className={className} size={size} />;
}
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { contactWhatsApp } from "@/features/showcase/showcaseData";
import { useNosotrosReveal } from "./useNosotrosReveal";
import "./nosotros.scss";

const pills = [
  { icon: "fas fa-code", label: "Ingeniería de Software" },
  { icon: "fas fa-network-wired", label: "Infraestructura de Redes" },
  { icon: "fas fa-user-tie", label: "Consultoría TI" },
  { icon: "fas fa-cloud", label: "Cloud & DevOps" },
];

const objectives = [
  {
    icon: "fas fa-lightbulb",
    gradient: "linear-gradient(135deg,#216ba8,#36b9cc)",
    title: "Innovación Continua",
    text: "Desarrollar y desplegar soluciones de software con las últimas tendencias tecnológicas para resolver necesidades emergentes del mercado.",
  },
  {
    icon: "fas fa-network-wired",
    gradient: "linear-gradient(135deg,#1cc28e,#059669)",
    title: "Excelencia en Infraestructura",
    text: "Garantizar la continuidad del negocio de nuestros aliados mediante el diseño y mantenimiento de redes y sistemas de alta disponibilidad.",
  },
  {
    icon: "fas fa-shield-alt",
    gradient: "linear-gradient(135deg,#e74a3b,#dc2626)",
    title: "Seguridad y Cumplimiento",
    text: "Implementar protocolos de ciberseguridad y estándares técnicos que aseguren la integridad de la información y el cumplimiento normativo (MIPG, Gobierno Digital).",
  },
  {
    icon: "fas fa-handshake",
    gradient: "linear-gradient(135deg,#7c3aed,#a855f7)",
    title: "Fidelización Estratégica",
    text: "Establecer relaciones de confianza a largo plazo basadas en soporte técnico especializado, transferencia de conocimiento y optimización de la inversión tecnológica.",
  },
  {
    icon: "fas fa-chart-line",
    gradient: "linear-gradient(135deg,#ff9900,#f59e0b)",
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
  useNosotrosReveal();

  useEffect(() => {
    document.body.classList.add("showcase-active");
    return () => {
      document.body.classList.remove("showcase-active");
    };
  }, []);

  return (
    <div className="nos-page">
      <header className="nos-hero">
        <div className="nos-hero-bg-text" aria-hidden="true">
          360°
        </div>
        <div className="nos-hero-glow nos-hero-glow-cyan" />
        <div className="nos-hero-glow nos-hero-glow-violet" />
        <div className="container nos-hero-inner">
          <Link to="/" className="nos-back-btn">
            <Si icon="fas fa-arrow-left" className="showcase-icon-inline" size={16} />
            Volver al inicio
          </Link>
          <div className="nos-hero-tag nos-animate">
            <Si icon="fas fa-building" className="showcase-icon-inline" size={16} />
            Nuestra Empresa
          </div>
          <h1 className="nos-hero-title nos-animate">
            Arquitectos de
            <br />
            <span className="nos-hero-accent">Soluciones Digitales</span>
          </h1>
          <p className="nos-hero-sub nos-animate">
            Transformamos organizaciones con tecnología de vanguardia, estrategia y propósito.
          </p>
          <div className="nos-hero-pills nos-animate">
            {pills.map((pill) => (
              <span key={pill.label} className="nos-pill">
                <Si icon={pill.icon} className="showcase-icon-inline" size={16} />
                {pill.label}
              </span>
            ))}
          </div>
        </div>
        <div className="nos-hero-wave">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#fff" />
          </svg>
        </div>
      </header>

      <section className="nos-intro">
        <div className="container">
          <div className="nos-section-header text-center nos-animate">
            <div className="nos-chip">
              <Si icon="fas fa-compass" className="showcase-icon-inline" size={16} />
              QUIÉNES SOMOS
            </div>
            <h2 className="nos-section-title">Conoce Softone360</h2>
            <p className="nos-section-sub">
              Una empresa creada para llevar la transformación digital al corazón de las
              organizaciones
            </p>
          </div>
          <div className="row align-items-start g-5 mt-1">
            <div className="col-lg-6 nos-animate">
              <p className="nos-body">
                En <strong>Softone360</strong>, somos arquitectos de soluciones digitales
                dedicados a potenciar la eficiencia organizacional mediante la integración
                estratégica de tecnología de última generación. Nuestra razón de ser es cerrar la
                brecha entre los desafíos operativos y las posibilidades tecnológicas,
                consolidándonos como el aliado estratégico de quienes no solo buscan
                digitalizarse, sino liderar una verdadera{" "}
                <strong>transformación cultural y funcional</strong>.
              </p>
              <p className="nos-body">
                Nuestro equipo multidisciplinario, experto en ingeniería de sistemas,
                infraestructura de redes y consultoría administrativa, nos permite ofrecer una
                perspectiva integral <strong>360°</strong>. Más allá de implementar software o
                hardware, diseñamos ecosistemas robustos y escalables que armonizan con las
                dinámicas del mercado y las rigurosas exigencias normativas del Estado.
              </p>
              <div className="nos-badges">
                {pills.map((pill) => (
                  <span key={pill.label} className="nos-badge">
                    <Si icon={pill.icon} className="showcase-icon-inline" size={16} />
                    {pill.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="col-lg-6 nos-animate">
              <div className="nos-mv-card nos-mv-mission">
                <div className="nos-mv-icon">
                  <Si icon="fas fa-rocket" className="" size={16} />
                </div>
                <div>
                  <div className="nos-mv-label">Misión</div>
                  <p className="nos-mv-text">
                    Impulsar la evolución digital de las organizaciones a través de soluciones
                    tecnológicas integrales y personalizadas. Transformamos procesos complejos en
                    experiencias ágiles mediante desarrollo de software de vanguardia,
                    infraestructura robusta y asesoría estratégica, garantizando seguridad,
                    escalabilidad y competitividad.
                  </p>
                </div>
              </div>
              <div className="nos-mv-card nos-mv-vision">
                <div className="nos-mv-icon">
                  <Si icon="fas fa-eye" className="" size={16} />
                </div>
                <div>
                  <div className="nos-mv-label">Visión 2030</div>
                  <p className="nos-mv-text">
                    Consolidarnos como el aliado tecnológico referente en el sector público y
                    privado, reconocidos por nuestra innovación y excelencia. Aspiramos a liderar la
                    transición hacia modelos de <strong>Gestión Digital Inteligente</strong>,
                    expandiendo nuestro impacto mediante soluciones que definan el futuro de la
                    productividad organizacional.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nos-objectives">
        <div className="container">
          <div className="nos-section-header text-center nos-animate">
            <h2 className="nos-section-title">Objetivos Corporativos</h2>
            <p className="nos-section-sub">
              Los cinco pilares que guían cada decisión y proyecto en Softone360
            </p>
          </div>
          <div className="row g-4 mt-2">
            {objectives.map((obj) => (
              <div
                key={obj.title}
                className={`nos-animate ${objectives.indexOf(obj) >= 3 ? "col-md-6 col-lg-6" : "col-md-6 col-lg-4"}`}
              >
                <div className="nos-obj-card">
                  <div className="nos-obj-icon" style={{ background: obj.gradient }}>
                    <Si icon={obj.icon} size={24} />
                  </div>
                  <h5 className="nos-obj-title">{obj.title}</h5>
                  <p className="nos-obj-text">{obj.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nos-intel">
        <div className="container">
          <div className="nos-section-header text-center nos-animate">
            <div className="nos-chip nos-chip-light">
              <Si icon="fas fa-brain" className="showcase-icon-inline" size={16} />
              ENFOQUE SECTOR PÚBLICO
            </div>
            <h2 className="nos-section-title text-white">
              Inteligencia Estratégica para la Gestión Pública
            </h2>
            <p className="nos-section-sub text-white-50">
              Entendemos que el futuro de la administración radica en la capacidad de respuesta.
              Nuestras soluciones están diseñadas para revolucionar la gestión pública.
            </p>
          </div>
          <div className="row g-4 mt-2">
            {intelItems.map((item) => (
              <div key={item.title} className="col-md-6 nos-animate">
                <div className="nos-intel-item">
                  <div className="nos-intel-icon">
                    <Si icon={item.icon} size={20} />
                  </div>
                  <div>
                    <h5 className="nos-intel-title">{item.title}</h5>
                    <p className="nos-intel-text">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="nos-intel-closing nos-animate">
            En Softone360, no solo construimos sistemas; entregamos la claridad técnica necesaria
            para gobernar con precisión y proyectar a las organizaciones hacia un futuro de éxito
            sostenible.
          </p>
        </div>
      </section>

      <section className="nos-cta">
        <div className="container">
          <div className="nos-cta-box nos-animate">
            <div className="row align-items-center">
              <div className="col-lg-7">
                <h2 className="nos-cta-title">¿Listo para transformar tu organización?</h2>
                <p className="nos-cta-text">
                  Hablemos sobre cómo SoftOne360 puede impulsar tu entidad hacia la gestión digital
                  inteligente.
                </p>
              </div>
              <div className="col-lg-5 text-lg-end mt-4 mt-lg-0 d-flex flex-wrap gap-3 justify-content-lg-end">
                <button
                  type="button"
                  className="nos-cta-btn nos-cta-btn-primary"
                  onClick={() => contactWhatsApp("Hola, quiero agendar una demo de SoftOne360.")}
                >
                  <Si icon="fab fa-whatsapp" className="showcase-icon-inline" size={16} />
                  Solicitar Demo
                </button>
                <Link to="/" className="nos-cta-btn nos-cta-btn-outline">
                  <Si icon="fas fa-home" className="showcase-icon-inline" size={16} />
                  Volver al inicio
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="nos-footer">
        <div className="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <span className="nos-brand-mark">S1</span>
            <div>
              <div className="nos-footer-brand">SoftOne360</div>
              <div className="nos-footer-tagline">Gestión Estratégica, Visión Total</div>
            </div>
          </div>
          <p className="nos-footer-copy mb-0">© 2026 SoftOne360 · Tunja, Boyacá, Colombia</p>
        </div>
      </footer>
    </div>
  );
}
