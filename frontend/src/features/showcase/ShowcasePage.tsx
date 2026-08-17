import { Link } from "react-router-dom";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";
import { isShowcaseHost } from "@/core/host";
import ShowcaseIcon from "./ShowcaseIcon";
import ShowcaseLogo from "./ShowcaseLogo";
import {
  benefits,
  contactWhatsApp,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  features,
  modules,
  stats,
  techStack,
  useCases,
} from "./showcaseData";
import HeroAiAccent from "./HeroAiAccent";
import PdmShowcaseSection from "./PdmShowcaseSection";
import { reveal, revealAlternate, revealCycle, revealUseCase } from "./revealVariants";
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
  const demoSpline = isShowcaseHost();

  const moduleTrack = [...modules, ...modules];

  return (
    <div className="showcase-main sc-fullbleed">
      {demoSpline && <Spotlight className="sc-page-spotlight" size={420} />}
      <section className={`sc-hero sc-hero--bleed${demoSpline ? " sc-hero--demo-spline" : ""}`}>
        <div className="sc-hero-stage" aria-hidden={demoSpline ? undefined : true}>
          {demoSpline ? (
            <>
              <div className="sc-hero-spline-panel">
                <div className="sc-hero-spline-shift">
                  <SplineScene
                    scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                    className="sc-hero-spline-canvas"
                  />
                </div>
              </div>
              <div className="sc-hero-veil sc-hero-veil--spline" />
            </>
          ) : (
            <>
              <div className="sc-hero-photo" />
              <div className="sc-hero-veil" />
              <div className="sc-hero-glow sc-hero-glow--primary" />
              <div className="sc-hero-glow sc-hero-glow--accent" />
              <div className="sc-hero-grid" />
              <div className="sc-hero-beam" />
            </>
          )}
        </div>

        <div className="sc-shell sc-hero-shell">
          <header className="sc-hero-topbar">
            <Link to="/" className="sc-hero-brand sc-hero-brand--xl" aria-label="SoftOne360 inicio">
              <ShowcaseLogo size={56} className="sc-hero-brand-logo" />
              <span className="sc-hero-brand-text">
                <strong>SoftOne360</strong>
                <small>Gestión estratégica, visión total</small>
              </span>
            </Link>
            {!demoSpline && (
              <nav className="sc-hero-toplinks" aria-label="Secciones">
                <a href="#pdm-destacado">PDM 360°</a>
                <a href="#modules">Módulos</a>
                <a href="#contact">Contacto</a>
                <Link to="/nosotros">Nosotros</Link>
              </nav>
            )}
          </header>

          <div className={`sc-hero-body${demoSpline ? " sc-hero-body--demo" : ""}`}>
            <div className={`sc-hero-copy ${reveal.clip}`} style={{ ["--hi" as string]: 0 }}>
              <h1 className="sc-hero-title sc-hero-title--xl">
                Gestión Pública <span className="sc-hero-highlight">360°</span>
                <HeroAiAccent />
              </h1>
              <p className="sc-hero-lead sc-hero-lead--wide">
                PDM, PQRS, contratación y planes institucionales en una plataforma multi-entidad
                con informes, dashboards e IA integrada.
              </p>
              <div className="sc-hero-actions">
                <button type="button" className="sc-btn sc-btn-primary sc-btn-lg" onClick={onLoginClick}>
                  <Si icon="fas fa-sign-in-alt" size={18} />
                  Ingresar al sistema
                </button>
                <Link to="/nosotros" className="sc-btn sc-btn-secondary sc-btn-lg">
                  Conocer la empresa
                </Link>
              </div>
            </div>
          </div>
        </div>

        <a href="#stats" className="sc-hero-scroll" aria-label="Ver más">
          <span />
        </a>
      </section>

      <button type="button" className="sc-fab" onClick={onLoginClick} title="Ingresar al sistema">
        <Si icon="fas fa-sign-in-alt" size={16} />
        Ingresar
      </button>

      <section className={`sc-stats-band${demoSpline ? " sc-stats-band--demo" : ""}`} id="stats">
        <div className="sc-shell">
          <div className={`sc-stats-row ${reveal.up}`}>
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="sc-stat sc-stat--band"
                style={{ ["--si" as string]: i }}
              >
                <span className="sc-stat-value">{stat.value}</span>
                <span className="sc-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PdmShowcaseSection />

      <section className="sc-section sc-section--bleed" id="features">
        <div className="sc-shell">
          <div className={`sc-section-head sc-section-head--wide ${reveal.clip}`}>
            <h2 className="sc-section-title">Capacidades del sistema</h2>
            <p className="sc-section-lead">
              Lo esencial de la plataforma, sin entrar al detalle de cada módulo.
            </p>
          </div>
          <div className="sc-feature-rail">
            {features.map((feature, i) => (
              <article
                key={feature.title}
                className={`sc-feature-band ${revealAlternate(i)}`}
                style={{ ["--feature-color" as string]: feature.color }}
              >
                <div className="sc-feature-band-icon">
                  <Si icon={feature.icon} size={22} />
                </div>
                <div className="sc-feature-band-copy">
                  <h3 className="sc-feature-title">{feature.title}</h3>
                  <p className="sc-feature-text">{feature.description}</p>
                </div>
                <span className="sc-feature-band-index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-alt sc-section--bleed" id="modules">
        <div className="sc-shell">
          <div className={`sc-section-head sc-section-head--wide ${reveal.down}`}>
            <h2 className="sc-section-title">Seis módulos integrados</h2>
            <p className="sc-section-lead">
              Seis áreas de gestión, integradas y con roles por secretaría.
            </p>
          </div>
        </div>

        <div className="sc-marquee" aria-hidden="true">
          <div className="sc-marquee-track">
            {moduleTrack.map((mod, i) => (
              <div
                key={`${mod.name}-${i}`}
                className="sc-marquee-chip"
                style={{ ["--module-color" as string]: mod.color }}
              >
                <Si icon={mod.icon} size={16} />
                {mod.name}
              </div>
            ))}
          </div>
        </div>

        <div className="sc-shell">
          <div className="sc-modules-grid sc-modules-grid--wide">
            {modules.map((mod, i) => (
              <article
                key={mod.name}
                className={`sc-module ${revealCycle(i)}`}
                style={{ ["--module-color" as string]: mod.color }}
              >
                <div className="sc-module-head">
                  <div className="sc-module-head-row">
                    <span className="sc-module-num">{String(i + 1).padStart(2, "0")}</span>
                    <div className="sc-module-icon">
                      <Si icon={mod.icon} size={20} />
                    </div>
                    <h3 className="sc-module-name">{mod.name}</h3>
                  </div>
                  <p className="sc-module-desc">{mod.description}</p>
                </div>
                <div className="sc-module-body">
                  <div className="sc-module-feats">
                    {mod.features.map((feat) => (
                      <div key={feat} className="sc-module-feat">
                        <Si icon="fas fa-check-circle" size={14} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section--bleed" id="benefits">
        <div className="sc-shell">
          <div className={`sc-section-head sc-section-head--wide ${reveal.fade}`}>
            <h2 className="sc-section-title">¿Por qué SoftOne360?</h2>
            <p className="sc-section-lead">
              Por qué conviene centralizar la gestión en un solo sistema.
            </p>
          </div>
          <div className="sc-cards-grid sc-cards-grid--benefits sc-cards-grid--wide">
            {benefits.map((benefit) => (
              <article key={benefit.title} className={`sc-benefit ${reveal.scale}`}>
                <div className="sc-benefit-icon">
                  <Si icon={benefit.icon} size={20} />
                </div>
                <h3 className="sc-benefit-title">{benefit.title}</h3>
                <p className="sc-benefit-text">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Link className="sc-about-banner sc-about-banner--bleed" to="/nosotros">
        <div className={`sc-shell sc-about-inner ${reveal.up}`}>
          <div>
            <span className="sc-chip sc-chip-light" style={{ marginBottom: "0.65rem" }}>
              <Si icon="fas fa-building" size={14} />
              Nuestra empresa
            </span>
            <h2 className="sc-about-title">Arquitectos de soluciones digitales</h2>
            <p className="sc-about-sub">Misión · Visión · Objetivos · Inteligencia estratégica</p>
          </div>
          <span className="sc-about-cta">
            Conocer nuestra historia
            <Si icon="fas fa-arrow-right" size={16} />
          </span>
        </div>
      </Link>

      <section className="sc-section sc-section-alt sc-section--bleed" id="use-cases">
        <div className="sc-shell">
          <div className={`sc-section-head sc-section-head--wide ${reveal.clip}`}>
            <h2 className="sc-section-title">Entidades que usan SoftOne360</h2>
            <p className="sc-section-lead">
              Diseñado para la institucionalidad territorial colombiana.
            </p>
          </div>
          <div className="sc-cards-grid sc-cards-grid--cases sc-cards-grid--wide">
            {useCases.map((useCase, i) => (
              <article key={useCase.title} className={`sc-use-case ${revealUseCase(i)}`}>
                <div className="sc-use-case-icon">
                  <Si icon={useCase.icon} size={20} />
                </div>
                <h3 className="sc-use-case-title">{useCase.title}</h3>
                <p className="sc-use-case-text">{useCase.description}</p>
                <div className="sc-use-case-metrics">
                  {useCase.metrics.map((metric) => (
                    <span key={metric}>
                      <Si icon="fas fa-check-circle" size={14} />
                      {metric}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section-dark sc-section--bleed">
        <div className="sc-shell">
          <div className={`sc-section-head sc-section-head--wide ${reveal.fade}`}>
            <h2 className="sc-section-title sc-section-title-light">Stack tecnológico</h2>
            <p className="sc-section-lead sc-section-lead-light">
              Stack en producción en app.softone360.com.
            </p>
          </div>
          <div className="sc-tech-grid sc-tech-grid--wide">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className={`sc-tech-item ${reveal.scale}`}
                style={{ ["--tech-color" as string]: tech.color }}
              >
                <div className="sc-tech-icon">
                  <Si icon={tech.icon} size={28} />
                </div>
                <div className="sc-tech-name">{tech.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sc-section sc-section--bleed" id="contact">
        <div className="sc-shell">
          <div className={`sc-cta sc-cta--wide ${reveal.clip}`}>
            <div className="sc-cta-content">
              <h2 className="sc-cta-title">¿Listo para digitalizar su entidad?</h2>
              <p className="sc-cta-text">
                Solicite acceso y conozca el sistema en funcionamiento.
              </p>
            </div>
            <button type="button" className="sc-btn sc-btn-light sc-btn-lg" onClick={onLoginClick}>
              <Si icon="fas fa-sign-in-alt" size={18} />
              Ingresar al sistema
            </button>
          </div>
        </div>
      </section>

      <footer className="sc-footer sc-footer--bleed">
        <div className="sc-shell">
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
                <a href="#pdm-destacado" className="sc-footer-link">
                  PDM 360°
                </a>
                <a href="#features" className="sc-footer-link">
                  Capacidades
                </a>
                <a href="#modules" className="sc-footer-link">
                  Módulos
                </a>
                <a href="#contact" className="sc-footer-link">
                  Contacto
                </a>
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
              <button
                type="button"
                className="sc-btn sc-btn-secondary sc-btn-lg sc-footer-wa"
                onClick={() => contactWhatsApp("Hola, quiero más información sobre SoftOne360.")}
              >
                <Si icon="fab fa-whatsapp" size={16} />
                WhatsApp
              </button>
            </div>
          </div>

          <div className="sc-footer-bottom">
            <p>© 2026 SoftOne360 · PDM 360° · React + Django + PostgreSQL</p>
            <p>Desarrollado en Tunja, Boyacá, Colombia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
