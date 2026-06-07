import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import ShowcaseIcon from "./ShowcaseIcon";
import ShowcaseNav, { HeroFeatureStrip } from "./ShowcaseNav";
import {
  benefits,
  contactWhatsApp,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  features,
  heroPanelItems,
  modules,
  pdmCapabilities,
  pdmFeatures,
  pdmStats,
  stats,
  techStack,
  useCases,
} from "./showcaseData";
import { useScrollReveal } from "./useScrollReveal";
import "./showcase.scss";

function Si({ icon, className, size = 20 }: { icon: string; className?: string; size?: number }) {
  return <ShowcaseIcon icon={icon} className={className} size={size} />;
}

interface ShowcasePageProps {
  onLoginClick: () => void;
}

export default function ShowcasePage({ onLoginClick }: ShowcasePageProps) {
  useScrollReveal();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="showcase-main">
      <ShowcaseNav onLoginClick={onLoginClick} onNavigate={scrollToSection} />

      <section className="hero-section">
        <div className="hero-overlay" />
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-7 hero-content animate">
              <div className="badge-pill mb-3">
                <Si icon="fas fa-star" className="showcase-icon-inline" size={16} />
                Sistema Líder en Gestión Pública — Colombia
              </div>
              <h1 className="hero-title mb-4">
                Gestión Pública <span className="text-gradient">360°</span> con{" "}
                <span className="tw-line">
                  <span className="typewriter-text">
                    <span className="tw-accent">Inteligencia Artificial</span>
                  </span>
                </span>
              </h1>
              <p className="hero-subtitle mb-4">
                Plataforma integral que centraliza el <strong>PDM</strong>, PQRS, Contratación
                Pública y Planes Institucionales. IA generativa con OpenAI, informes automáticos
                en PDF, dashboards en tiempo real y acceso seguro multi-entidad.
              </p>
              <HeroFeatureStrip />
              <div className="hero-actions">
                <button type="button" className="hero-btn hero-btn-ingresar" onClick={onLoginClick}>
                  <Si icon="fas fa-sign-in-alt" className="showcase-icon-inline" size={16} />
                  Ingresar
                </button>
              </div>
              <div className="hero-stats mt-5">
                {stats.map((stat) => (
                  <div key={stat.label} className="stat-item">
                    <Si icon={stat.icon} className="stat-icon" size={24} />
                    <div>
                      <div className="stat-value">{stat.value}</div>
                      <div className="stat-label">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-5 d-none d-md-flex align-items-center justify-content-center animate">
              <div className="hero-panel">
                {heroPanelItems.map((item, pi) => (
                  <div key={item.title} className="hero-panel-item" style={{ ["--pi" as string]: pi }}>
                    <div className="hero-panel-icon" style={{ background: item.gradient }}>
                      <Si icon={item.icon} size={20} />
                    </div>
                    <div>
                      <div className="hero-panel-title">{item.title}</div>
                      <div className="hero-panel-sub">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="hero-wave">
          <svg viewBox="0 0 1440 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              fill="#ffffff"
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      <button type="button" className="portales-fab d-md-none" onClick={onLoginClick} title="Ingresar al Sistema">
        <Si icon="fas fa-sign-in-alt" className="" size={16} />
        <span className="fab-label">Ingresar</span>
      </button>

      <section className="pdm-hero-section" id="pdm-destacado">
        <div className="pdm-hero-bg" />
        <div className="container position-relative">
          <div className="pdm-section-header text-center animate">
            <div className="pdm-badge">
              <Si icon="fas fa-star" className="showcase-icon-inline" size={16} />
              MÓDULO ESTRELLA
            </div>
            <h2 className="pdm-main-title">
              Plan de Desarrollo Municipal
              <span className="pdm-title-accent">PDM 360°</span>
            </h2>
            <p className="pdm-main-subtitle">
              La solución más completa para el seguimiento, ejecución y rendición de cuentas del
              Plan de Desarrollo Municipal de su entidad territorial.
            </p>
          </div>

          <div className="row g-4 mb-5 showcase-grid">
            {pdmCapabilities.map((cap) => (
              <div key={cap.title} className="col-md-6 col-lg-4 animate">
                <div className="pdm-cap-card">
                  <div className="pdm-cap-icon" style={{ background: cap.gradient }}>
                    <Si icon={cap.icon} size={24} />
                  </div>
                  <h4>{cap.title}</h4>
                  <p>{cap.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pdm-detail-box animate">
            <div className="row align-items-center">
              <div className="col-lg-5">
                <div className="pdm-visual-block">
                  <div className="pdm-flow-diagram">
                    <div className="pdm-flow-item pdm-flow-root">
                      <Si icon="fas fa-flag" className="" size={16} />
                      <span>Línea Estratégica</span>
                    </div>
                    <div className="pdm-flow-connector" />
                    <div className="pdm-flow-item pdm-flow-sector">
                      <Si icon="fas fa-industry" className="" size={16} />
                      <span>Sector / Programa</span>
                    </div>
                    <div className="pdm-flow-connector" />
                    <div className="pdm-flow-item pdm-flow-product">
                      <Si icon="fas fa-box" className="" size={16} />
                      <span>Producto + Indicador</span>
                    </div>
                    <div className="pdm-flow-connector" />
                    <div className="pdm-flow-item pdm-flow-activity">
                      <Si icon="fas fa-tasks" className="" size={16} />
                      <span>Actividad + Evidencia</span>
                    </div>
                    <div className="pdm-flow-connector" />
                    <div className="pdm-flow-item pdm-flow-budget">
                      <Si icon="fas fa-dollar-sign" className="" size={16} />
                      <span>Ejecución Presupuestal</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-7">
                <h3 className="pdm-detail-title">
                  <Si icon="fas fa-map-marked-alt me-3" className="" size={16} />
                  Todo el PDM en una sola plataforma
                </h3>
                <p className="pdm-detail-text">
                  Desde la carga del Plan de Desarrollo Municipal en Excel hasta la generación del
                  informe de rendición de cuentas — <strong>SoftOne360</strong> cubre el ciclo
                  completo con tecnología de punta.
                </p>
                <div className="pdm-features-grid">
                  {pdmFeatures.map((feat) => (
                    <div key={feat} className="pdm-feat-item">
                      <Si icon="fas fa-check-circle" className="" size={16} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pdm-stats-row">
            {pdmStats.map((stat) => (
              <div key={stat.label} className="pdm-stat-box animate">
                <div className="pdm-stat-icon">
                  <Si icon={stat.icon} size={22} />
                </div>
                <div className="pdm-stat-value">{stat.value}</div>
                <div className="pdm-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="features-section py-5" id="features">
        <div className="container">
          <div className="section-header text-center mb-5 animate">
            <h2 className="section-title">Capacidades del Sistema</h2>
            <p className="section-subtitle">
              Tecnología de vanguardia al servicio real del sector público colombiano
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {features.map((feature) => (
              <div key={feature.title} className="col-md-6 col-lg-4 animate">
                <div className="feature-card">
                  <div
                    className="feature-icon"
                    style={{
                      background: `linear-gradient(135deg, ${feature.color}, ${feature.color}dd)`,
                    }}
                  >
                    <Si icon={feature.icon} size={28} />
                  </div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-description">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="modules-v2-section" id="modules">
        <div className="container">
          <div className="modules-v2-header text-center animate">
            <div className="section-chip">
              <Si icon="fas fa-cubes" className="showcase-icon-inline" size={16} />
              6 MÓDULOS INTEGRADOS
            </div>
            <h2 className="section-title mt-3">Sistema Completo de Gestión Pública</h2>
            <p className="section-subtitle">
              Cada módulo diseñado con precisión para las necesidades reales del sector público
              colombiano — todo en una sola plataforma
            </p>
          </div>

          {modules.map((mod, i) => (
            <div key={mod.name} className="module-v2-block animate">
              <div
                className="module-v2-header"
                style={{
                  background: `linear-gradient(135deg,${mod.color} 0%,${mod.color}99 100%)`,
                }}
              >
                <span className="module-v2-num">{String(i + 1).padStart(2, "0")}</span>
                <div className="module-v2-icon">
                  <Si icon={mod.icon} size={24} />
                </div>
                <div className="module-v2-title-area">
                  <span className="module-v2-chip">MÓDULO</span>
                  <h3 className="module-v2-name">{mod.name}</h3>
                  <p className="module-v2-desc">{mod.description}</p>
                </div>
              </div>
              <div className="module-v2-body">
                {mod.capabilities && (
                  <div className="module-v2-caps">
                    {mod.capabilities.map((cap) => (
                      <div key={cap.title} className="module-v2-cap">
                        <div className="cap-icon-wrap" style={{ background: cap.gradient }}>
                          <Si icon={cap.icon} size={24} />
                        </div>
                        <div className="cap-text">
                          <h6 className="cap-title">{cap.title}</h6>
                          <p className="cap-desc">{cap.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="module-v2-features-header">
                  <i className="fas fa-check-square me-2" style={{ color: mod.color }} />
                  Funcionalidades incluidas
                </div>
                <div className="module-v2-feats">
                  {mod.features.map((feat) => (
                    <div key={feat} className="module-v2-feat">
                      <i className="fas fa-check-circle" style={{ color: mod.color }} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="benefits-section py-5">
        <div className="container">
          <div className="section-header text-center mb-5 animate">
            <h2 className="section-title">¿Por Qué Elegir SoftOne360?</h2>
            <p className="section-subtitle">
              Infraestructura, seguridad y tecnología al nivel de las mejores soluciones
              empresariales
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="col-md-6 col-lg-4 animate">
                <div className="benefit-card">
                  <div className="benefit-icon">
                    <Si icon={benefit.icon} size={28} />
                  </div>
                  <h4 className="benefit-title">{benefit.title}</h4>
                  <p className="benefit-description">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Link className="about-spotlight" to="/nosotros">
        <div className="about-spotlight-inner">
          <div className="about-spotlight-tag">
            <Si icon="fas fa-building" className="showcase-icon-inline" size={16} />
            Nuestra Empresa
          </div>
          <h2 className="about-spotlight-title">
            Arquitectos de <span className="about-spotlight-accent">Soluciones Digitales</span>
          </h2>
          <p className="about-spotlight-sub">
            Misión &bull; Visión &bull; Objetivos &bull; Inteligencia Estratégica
          </p>
          <div className="about-spotlight-cta">
            <span>Conocé nuestra historia</span>
            <Si icon="fas fa-arrow-right" className="ms-3" size={16} />
          </div>
        </div>
        <div className="about-spotlight-bg-text" aria-hidden="true">
          360°
        </div>
      </Link>

      <section className="use-cases-section py-5 bg-light">
        <div className="container">
          <div className="section-header text-center mb-5 animate">
            <h2 className="section-title">Entidades que Usan SoftOne360</h2>
            <p className="section-subtitle">
              Diseñado para toda la institucionalidad territorial colombiana
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {useCases.map((useCase) => (
              <div key={useCase.title} className="col-lg-4 animate">
                <div className="use-case-card">
                  <div className="use-case-icon">
                    <Si icon={useCase.icon} size={32} />
                  </div>
                  <h3 className="use-case-title">{useCase.title}</h3>
                  <p className="use-case-description">{useCase.description}</p>
                  <div className="use-case-metrics">
                    {useCase.metrics.map((metric) => (
                      <div key={metric} className="metric">
                        <Si icon="fas fa-check-circle" className="showcase-icon-inline" size={16} />
                        {metric}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tech-section py-5 bg-dark text-white">
        <div className="container">
          <div className="section-header text-center mb-5 animate">
            <h2 className="section-title text-white">Stack Tecnológico Real</h2>
            <p className="section-subtitle text-white-50">
              Las tecnologías que realmente potencian SoftOne360 en app.softone360.com
            </p>
          </div>
          <div className="tech-stack">
            {techStack.map((tech) => (
              <div key={tech.name} className="tech-item animate">
                <div className="tech-icon" style={{ color: tech.color }}>
                  <Si icon={tech.icon} size={36} />
                </div>
                <div className="tech-name">{tech.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section py-5" id="contact">
        <div className="container">
          <div className="cta-box animate">
            <div className="row align-items-center">
              <div className="col-lg-8">
                <h2 className="cta-title mb-3">¿Listo para digitalizar su entidad con PDM 360°?</h2>
                <p className="cta-text mb-0">
                  Conozca la plataforma que centraliza el Plan de Desarrollo Municipal, PQRS y la
                  gestión institucional de su entidad territorial.
                </p>
              </div>
              <div className="col-lg-4 text-lg-end mt-4 mt-lg-0">
                <button type="button" className="btn btn-light btn-lg" onClick={onLoginClick}>
                  <Si icon="fas fa-sign-in-alt" className="showcase-icon-inline" size={16} />
                  Ingresar al Sistema
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="showcase-footer py-5 bg-dark text-white">
        <div className="container">
          <div className="row mb-4">
            <div className="col-md-4 mb-4 mb-md-0">
              <div className="d-flex align-items-center mb-3">
                <span className="showcase-brand-mark me-2">S1</span>
                <div>
                  <h5 className="mb-0 fw-bold">SoftOne360</h5>
                  <small className="text-white-50">Gestión Estratégica, Visión Total</small>
                </div>
              </div>
              <p className="text-white-50 small">
                Plataforma integral de gestión pública con IA generativa, analytics avanzado y
                cumplimiento normativo garantizado.
              </p>
            </div>
            <div className="col-md-4 mb-4 mb-md-0">
              <h6 className="fw-bold mb-3">Enlaces Rápidos</h6>
              <ul className="list-unstyled">
                <li className="mb-2">
                  <button
                    type="button"
                    className="btn btn-link text-white-50 text-decoration-none p-0 border-0"
                    onClick={() => scrollToSection("pdm-destacado")}
                  >
                    <Si icon="fas fa-chevron-right" className="showcase-icon-inline" size={16} />
                    PDM 360°
                  </button>
                </li>
                <li className="mb-2">
                  <button
                    type="button"
                    className="btn btn-link text-white-50 text-decoration-none p-0 border-0"
                    onClick={() => scrollToSection("features")}
                  >
                    <Si icon="fas fa-chevron-right" className="showcase-icon-inline" size={16} />
                    Capacidades
                  </button>
                </li>
                <li className="mb-2">
                  <Link className="text-white-50 text-decoration-none" to="/nosotros">
                    <Si icon="fas fa-chevron-right" className="showcase-icon-inline" size={16} />
                    Nosotros
                  </Link>
                </li>
                <li className="mb-2">
                  <button
                    type="button"
                    className="btn btn-link text-white-50 text-decoration-none p-0 border-0"
                    onClick={() => scrollToSection("modules")}
                  >
                    <Si icon="fas fa-chevron-right" className="showcase-icon-inline" size={16} />
                    Módulos
                  </button>
                </li>
                <li className="mb-2">
                  <button
                    type="button"
                    className="btn btn-link text-white-50 text-decoration-none p-0 border-0"
                    onClick={() => scrollToSection("contact")}
                  >
                    <Si icon="fas fa-chevron-right" className="showcase-icon-inline" size={16} />
                    Contacto
                  </button>
                </li>
              </ul>
            </div>
            <div className="col-md-4">
              <h6 className="fw-bold mb-3">Contacto</h6>
              <p className="text-white-50 small mb-2">
                <Si icon="fas fa-envelope" className="showcase-icon-inline" size={16} />
                {CONTACT_EMAIL}
              </p>
              <p className="text-white-50 small mb-2">
                <Si icon="fas fa-phone" className="showcase-icon-inline" size={16} />
                {CONTACT_PHONE}
              </p>
              <p className="text-white-50 small mb-3">
                <Si icon="fas fa-map-marker-alt" className="showcase-icon-inline" size={16} />
                Tunja - Boyacá, Colombia
              </p>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() =>
                  contactWhatsApp("Hola, quiero más información sobre SoftOne360.")
                }
              >
                <Si icon="fab fa-whatsapp" className="showcase-icon-inline" size={16} />
                Escríbenos por WhatsApp
              </button>
            </div>
          </div>
          <hr className="border-secondary my-4" />
          <div className="row align-items-center">
            <div className="col-md-6 text-center text-md-start mb-3 mb-md-0">
              <p className="mb-0 small">
                <Si icon="fas fa-code" className="showcase-icon-inline" size={16} />
                Desarrollado con <Si icon="fas fa-heart mx-1" className="text-danger mx-1" size={14} /> por SoftOne360 —
                Tunja, Boyacá, Colombia
              </p>
            </div>
            <div className="col-md-6 text-center text-md-end">
              <p className="mb-0 small">
                © 2026 SoftOne360 · PDM 360° · React + Django + PostgreSQL · Todos los derechos
                reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
