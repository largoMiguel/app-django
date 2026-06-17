import ShowcaseIcon from "./ShowcaseIcon";
import {
  pdmCapabilities,
  pdmFeatures,
  pdmStats,
} from "./showcaseData";
import { reveal, revealCycle } from "./revealVariants";

function Si({ icon, size = 20 }: { icon: string; size?: number }) {
  return <ShowcaseIcon icon={icon} size={size} />;
}

const PDM_FLOW = [
  { icon: "fas fa-flag", label: "Línea estratégica", color: "#7ec8e8" },
  { icon: "fas fa-industry", label: "Sector / programa", color: "#5eead4" },
  { icon: "fas fa-box", label: "Producto + indicador", color: "#34d399" },
  { icon: "fas fa-tasks", label: "Actividad + evidencia", color: "#fbbf24" },
  { icon: "fas fa-dollar-sign", label: "Ejecución presupuestal", color: "#f87171" },
];

const CAP_COLORS = ["#5eead4", "#7ec8e8", "#34d399", "#fbbf24", "#f87171", "#a78bfa"];

export default function PdmShowcaseSection() {
  return (
    <section className="sc-pdm-section" id="pdm-destacado">
      <div className="sc-pdm-bg" aria-hidden="true">
        <span className="sc-pdm-orb sc-pdm-orb--1" />
        <span className="sc-pdm-orb sc-pdm-orb--2" />
      </div>

      <div className="container sc-pdm-container">
        <header className={`sc-pdm-hero ${reveal.clip}`}>
          <div className="sc-pdm-hero-badge">
            <Si icon="fas fa-map-marked-alt" size={14} />
            Módulo principal
          </div>
          <h2 className="sc-pdm-hero-title">
            Plan de Desarrollo Municipal
            <span className="sc-pdm-hero-accent">PDM 360°</span>
          </h2>
          <p className="sc-pdm-hero-lead">
            Del plan a la rendición de cuentas — seguimiento, ejecución e informes en un solo lugar.
          </p>
        </header>

        <div className="sc-pdm-caps">
          {pdmCapabilities.map((cap, i) => (
            <article
              key={cap.title}
              className={`sc-pdm-cap ${revealCycle(i)}`}
              style={{
                ["--cap-color" as string]: CAP_COLORS[i % CAP_COLORS.length],
                ["--cap-i" as string]: i,
              }}
            >
              <div className="sc-pdm-cap-icon">
                <Si icon={cap.icon} size={22} />
              </div>
              <h3 className="sc-pdm-cap-title">{cap.title}</h3>
              <p className="sc-pdm-cap-text">{cap.text}</p>
              <span className="sc-pdm-cap-shine" aria-hidden="true" />
            </article>
          ))}
        </div>

        <div className="sc-pdm-detail">
          <div className={`sc-pdm-flow-live ${reveal.left}`} aria-label="Estructura jerárquica del PDM">
            {PDM_FLOW.map((step, i) => (
              <div key={step.label} className="sc-pdm-flow-item">
                <div
                  className="sc-pdm-flow-step"
                  style={{
                    ["--flow-i" as string]: i,
                    ["--flow-color" as string]: step.color,
                  }}
                >
                  <span className="sc-pdm-flow-num">{i + 1}</span>
                  <Si icon={step.icon} size={16} />
                  <span>{step.label}</span>
                </div>
                {i < PDM_FLOW.length - 1 && (
                  <div
                    className="sc-pdm-flow-connector"
                    style={{ ["--flow-i" as string]: i }}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>

          <div className={`sc-pdm-detail-body ${reveal.right}`}>
            <h3 className="sc-pdm-detail-title">Ciclo completo del PDM</h3>
            <p className="sc-pdm-detail-lead">
              Carga en Excel, seguimiento por secretaría e informe final con trazabilidad completa.
            </p>
            <div className="sc-pdm-feat-pills">
              {pdmFeatures.map((feat, i) => (
                <span
                  key={feat}
                  className={`sc-pdm-feat-pill ${reveal.fade}`}
                  style={{ ["--pill-i" as string]: i }}
                >
                  <Si icon="fas fa-check-circle" size={13} />
                  {feat}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="sc-pdm-stats">
          {pdmStats.map((stat, i) => (
            <div
              key={stat.label}
              className={`sc-pdm-stat ${reveal.scale}`}
              style={{ ["--stat-i" as string]: i }}
            >
              <span className="sc-pdm-stat-icon">
                <Si icon={stat.icon} size={18} />
              </span>
              <span className="sc-pdm-stat-value">{stat.value}</span>
              <span className="sc-pdm-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
