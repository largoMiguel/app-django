import { Link } from "react-router-dom";
import ShowcaseIcon from "./ShowcaseIcon";
import ShowcaseNav, { scrollToSection } from "./ShowcaseNav";
import ShowcaseLogo from "./ShowcaseLogo";
import {
  benefits,
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

const NAV_LINKS = [
  { id: "pdm-destacado", label: "PDM 360°" },
  { id: "features", label: "Capacidades" },
  { id: "modules", label: "Módulos" },
  { id: "contact", label: "Contacto" },
] as const;

export default function ShowcasePage({ onLoginClick }: ShowcasePageProps) {
  useScrollReveal();

  return (
    <div className="showcase-main">
      <ShowcaseNav
        navLabel="Secciones principales"
        items={[
          ...NAV_LINKS.map((link) => ({
            type: "scroll" as const,
            sectionId: link.id,
            label: link.label,
          })),
          { type: "link" as const, to: "/nosotros", label: "Nosotros" },
        ]}
        cta={
          <button type="button" className="sc-btn sc-btn-primary sc-nav-cta" onClick={onLoginClick}>
            <Si icon="fas fa-sign-in-alt" size={16} />
            Ingresar
          </button>
        }
      />

      <section className="sc-hero hero-section">
        <div className="sc-hero-grid" aria-hidden="true" />
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-7 hero-content">
              <p className="sc-eyebrow sc-hero-eyebrow">
                <Si icon="fas fa-star" size={14} />
                Plataforma líder en gestión pública — Colombia
              </p>
              <h1 className="sc-hero-title">
                <span className="sc-hero-line">
                  Gestión pública <span className="sc-hero-accent">360°</span>
                </span>
                <span className="sc-hero-line">
                  con <span className="sc-hero-highlight">inteligencia artificial</span>
                </span>
              </h1>
              <p className="sc-hero-lead sc-hero-lead-block">
                Centralice el <strong>PDM</strong>, PQRS, contratación pública y planes institucionales.
                Informes PDF automáticos, dashboards en tiempo real y acceso seguro multi-entidad.
              </p>
              <dl className="sc-stat-bar mt-4">
                {stats.map((stat, i) => (
                  <div
                    key={stat.label}
                    className="sc-stat-item sc-hero-stat"
                    style={{ ["--hi" as string]: i }}
                  >
                    <Si icon={stat.icon} className="sc-stat-icon" size={18} />
                    <div>
                      <dt className="sc-stat-value">{stat.value}</dt>
                      <dd className="sc-stat-label">{stat.label}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
            <div className="col-lg-5 d-none d-md-flex align-items-center justify-content-center">
              <div className="hero-panel sc-hero-stack">
                {heroPanelItems.map((item, pi) => (
                  <div key={item.title} className="hero-panel-item sc-stack-item" style={{ ["--pi" as string]: pi }}>
                    <div className="sc-stack-icon" style={{ ["--module-color" as string]: item.gradient }}>
                      <Si icon={item.icon} size={18} />
                    </div>
                    <div>
                      <div className="sc-stack-title">{item.title}</div>
                      <div className="sc-stack-sub">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-dark pdm-hero-section" id="pdm-destacado">
        <div className="container position-relative">
          <div className="pdm-section-header sc-section-head text-center animate">
            <span className="sc-chip sc-chip-gold">
              <Si icon="fas fa-star" size={14} />
              Módulo estrella
            </span>
            <h2 className="sc-section-title sc-section-title-light">
              Plan de Desarrollo Municipal
              <span className="sc-title-em">PDM 360°</span>
            </h2>
            <p className="sc-section-lead sc-section-lead-light">
              Seguimiento, ejecución y rendición de cuentas del PDM en una sola plataforma diseñada
              para entidades territoriales colombianas.
            </p>
          </div>

          <div className="sc-bento row g-4 mb-5 showcase-grid">
            {pdmCapabilities.map((cap) => (
              <div key={cap.title} className="col-md-6 col-lg-4 animate">
                <article className="sc-glass-card pdm-cap-card">
                  <div className="sc-card-icon pdm-cap-icon">
                    <Si icon={cap.icon} size={22} />
                  </div>
                  <h3 className="sc-card-title">{cap.title}</h3>
                  <p className="sc-card-text">{cap.text}</p>
                </article>
              </div>
            ))}
          </div>

          <div className="sc-panel pdm-detail-box animate">
            <div className="row align-items-start g-4">
              <div className="col-lg-5">
                <div className="pdm-visual-block">
                  <div className="pdm-flow-diagram sc-flow">
                    {[
                      { cls: "pdm-flow-root", icon: "fas fa-flag", label: "Línea Estratégica" },
                      { cls: "pdm-flow-sector", icon: "fas fa-industry", label: "Sector / Programa" },
                      { cls: "pdm-flow-product", icon: "fas fa-box", label: "Producto + Indicador" },
                      { cls: "pdm-flow-activity", icon: "fas fa-tasks", label: "Actividad + Evidencia" },
                      { cls: "pdm-flow-budget", icon: "fas fa-dollar-sign", label: "Ejecución Presupuestal" },
                    ].map((step, i, arr) => (
                      <div key={step.label}>
                        <div className={`pdm-flow-item sc-flow-step ${step.cls}`}>
                          <Si icon={step.icon} size={16} />
                          <span>{step.label}</span>
                        </div>
                        {i < arr.length - 1 && <div className="pdm-flow-connector" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-lg-7">
                <h3 className="sc-panel-title">
                  <Si icon="fas fa-map-marked-alt" size={20} />
                  Todo el PDM en una sola plataforma
                </h3>
                <p className="sc-panel-lead">
                  Desde la carga del Plan de Desarrollo Municipal en Excel hasta el informe de
                  rendición de cuentas — <strong>SoftOne360</strong> cubre el ciclo completo.
                </p>
                <ul className="sc-check-list pdm-features-grid">
                  {pdmFeatures.map((feat) => (
                    <li key={feat} className="pdm-feat-item">
                      <Si icon="fas fa-check-circle" size={16} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="sc-metrics pdm-stats-row">
            {pdmStats.map((stat) => (
              <div key={stat.label} className="pdm-stat-box sc-metric animate">
                <Si icon={stat.icon} className="pdm-stat-icon" size={20} />
                <div className="pdm-stat-value sc-metric-value">{stat.value}</div>
                <div className="pdm-stat-label sc-metric-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section features-section" id="features">
        <div className="container">
          <div className="section-header sc-section-head text-center animate">
            <span className="sc-chip">Capacidades</span>
            <h2 className="sc-section-title section-title">Tecnología al servicio del sector público</h2>
            <p className="sc-section-lead section-subtitle">
              Herramientas reales para alcaldías, gobernaciones y entidades descentralizadas.
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {features.map((feature, i) => (
              <div key={feature.title} className="col-md-6 col-lg-4 animate">
                <article
                  className="feature-card sc-feature-card"
                  style={{ ["--feature-accent" as string]: feature.color }}
                >
                  <div className="feature-icon sc-feature-icon">
                    <Si icon={feature.icon} size={24} />
                  </div>
                  <h3 className="feature-title sc-feature-title">{feature.title}</h3>
                  <p className="feature-description sc-feature-text">{feature.description}</p>
                  <span className="sc-feature-index">{String(i + 1).padStart(2, "0")}</span>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-alt modules-v2-section" id="modules">
        <div className="container">
          <div className="modules-v2-header sc-section-head text-center animate">
            <span className="sc-chip">
              <Si icon="fas fa-cubes" size={14} />
              6 módulos integrados
            </span>
            <h2 className="sc-section-title section-title mt-3">Sistema completo de gestión pública</h2>
            <p className="sc-section-lead section-subtitle">
              Cada módulo responde a necesidades reales del sector público colombiano.
            </p>
          </div>

          <div className="sc-modules">
            {modules.map((mod, i) => (
              <article
                key={mod.name}
                className="module-v2-block sc-module animate"
                style={{ ["--module-color" as string]: mod.color }}
              >
                <header className="module-v2-header sc-module-head">
                  <span className="module-v2-num sc-module-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="module-v2-icon sc-module-icon">
                    <Si icon={mod.icon} size={22} />
                  </div>
                  <div className="module-v2-title-area">
                    <span className="module-v2-chip sc-module-chip">Módulo</span>
                    <h3 className="module-v2-name sc-module-name">{mod.name}</h3>
                    <p className="module-v2-desc sc-module-desc">{mod.description}</p>
                  </div>
                </header>
                <div className="module-v2-body sc-module-body">
                  {mod.capabilities && (
                    <div className="module-v2-caps sc-module-caps">
                      {mod.capabilities.map((cap) => (
                        <div key={cap.title} className="module-v2-cap sc-cap">
                          <div className="cap-icon-wrap sc-cap-icon">
                            <Si icon={cap.icon} size={18} />
                          </div>
                          <div className="cap-text">
                            <h4 className="cap-title">{cap.title}</h4>
                            <p className="cap-desc">{cap.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="module-v2-features-header sc-module-feats-label">
                    <Si icon="fas fa-check-square" size={14} />
                    Funcionalidades incluidas
                  </p>
                  <ul className="module-v2-feats sc-module-feats">
                    {mod.features.map((feat) => (
                      <li key={feat} className="module-v2-feat">
                        <Si icon="fas fa-check-circle" size={14} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section benefits-section">
        <div className="container">
          <div className="section-header sc-section-head text-center animate">
            <span className="sc-chip">Ventajas</span>
            <h2 className="sc-section-title section-title">¿Por qué SoftOne360?</h2>
            <p className="sc-section-lead section-subtitle">
              Infraestructura, seguridad y tecnología de nivel empresarial.
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="col-md-6 col-lg-4 animate">
                <article className="benefit-card sc-benefit">
                  <div className="benefit-icon sc-benefit-icon">
                    <Si icon={benefit.icon} size={24} />
                  </div>
                  <h3 className="benefit-title sc-benefit-title">{benefit.title}</h3>
                  <p className="benefit-description sc-benefit-text">{benefit.description}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Link className="about-spotlight sc-about-band" to="/nosotros">
        <div className="container sc-about-inner">
          <span className="sc-chip sc-chip-light">
            <Si icon="fas fa-building" size={14} />
            Nuestra empresa
          </span>
          <h2 className="sc-about-title">
            Arquitectos de <em>soluciones digitales</em> para el sector público
          </h2>
          <p className="sc-about-sub">Misión · Visión · Objetivos · Inteligencia estratégica</p>
          <span className="sc-about-cta">
            Conocer nuestra historia
            <Si icon="fas fa-arrow-right" size={16} />
          </span>
        </div>
      </Link>

      <section className="sc-section sc-section-alt use-cases-section">
        <div className="container">
          <div className="section-header sc-section-head text-center animate">
            <span className="sc-chip">Entidades</span>
            <h2 className="sc-section-title section-title">Diseñado para la institucionalidad territorial</h2>
            <p className="sc-section-lead section-subtitle">
              Alcaldías, gobernaciones y entidades descentralizadas en Colombia.
            </p>
          </div>
          <div className="row g-4 showcase-grid">
            {useCases.map((useCase) => (
              <div key={useCase.title} className="col-lg-4 animate">
                <article className="use-case-card sc-use-case">
                  <div className="use-case-icon sc-use-icon">
                    <Si icon={useCase.icon} size={28} />
                  </div>
                  <h3 className="use-case-title sc-use-title">{useCase.title}</h3>
                  <p className="use-case-description sc-use-text">{useCase.description}</p>
                  <ul className="use-case-metrics sc-use-metrics">
                    {useCase.metrics.map((metric) => (
                      <li key={metric} className="metric">
                        <Si icon="fas fa-check-circle" size={14} />
                        {metric}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-dark tech-section">
        <div className="container">
          <div className="section-header sc-section-head text-center animate">
            <span className="sc-chip sc-chip-light">Stack</span>
            <h2 className="sc-section-title sc-section-title-light section-title">Tecnología de producción</h2>
            <p className="sc-section-lead sc-section-lead-light section-subtitle">
              El stack real que impulsa app.softone360.com
            </p>
          </div>
          <div className="tech-stack sc-tech-grid">
            {techStack.map((tech) => (
              <div key={tech.name} className="tech-item sc-tech-item animate">
                <Si icon={tech.icon} className="tech-icon" size={28} />
                <span className="tech-name sc-tech-name">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section cta-section" id="contact">
        <div className="container">
          <div className="cta-box sc-cta animate">
            <div className="sc-cta-content">
              <h2 className="cta-title sc-cta-title">¿Listo para digitalizar su entidad?</h2>
              <p className="cta-text sc-cta-text">
                Centralice el PDM, PQRS y la gestión institucional de su entidad territorial en una
                sola plataforma segura.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="showcase-footer sc-footer">
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
                {NAV_LINKS.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    className="sc-footer-link"
                    onClick={() => scrollToSection(link.id)}
                  >
                    {link.label}
                  </button>
                ))}
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
