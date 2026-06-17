export interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

export interface Module {
  name: string;
  icon: string;
  description: string;
  features: string[];
  color: string;
}

export interface Stat {
  value: string;
  label: string;
  icon: string;
}

export interface Benefit {
  icon: string;
  title: string;
  description: string;
}

export interface UseCase {
  icon: string;
  title: string;
  description: string;
  metrics: string[];
}

export interface TechItem {
  name: string;
  icon: string;
  color: string;
}

export const stats: Stat[] = [
  { value: "6", label: "Módulos", icon: "fas fa-cubes" },
  { value: "360°", label: "Gestión pública", icon: "fas fa-sync-alt" },
  { value: "Multi", label: "Entidad y roles", icon: "fas fa-building" },
  { value: "IA", label: "OpenAI", icon: "fas fa-brain" },
];

export const heroPanelItems = [
  {
    icon: "fas fa-map-marked-alt",
    title: "PDM 360°",
    sub: "Plan de Desarrollo Municipal",
    gradient: "linear-gradient(135deg,#216ba8,#36b9cc)",
  },
  {
    icon: "fas fa-brain",
    title: "IA Generativa",
    sub: "Informes y asistencia",
    gradient: "linear-gradient(135deg,#7c3aed,#a855f7)",
  },
  {
    icon: "fas fa-file-pdf",
    title: "Informes PDF",
    sub: "Generación automática",
    gradient: "linear-gradient(135deg,#e74a3b,#f97316)",
  },
  {
    icon: "fas fa-users",
    title: "Multi-Entidad",
    sub: "Datos aislados por organización",
    gradient: "linear-gradient(135deg,#1cc28e,#059669)",
  },
];

/** Capacidades transversales — sin repetir el detalle de cada módulo. */
export const features: Feature[] = [
  {
    icon: "fas fa-map-marked-alt",
    title: "PDM de punta a punta",
    description:
      "Líneas estratégicas, productos, actividades, indicadores y ejecución presupuestal en una sola vista.",
    color: "#216ba8",
  },
  {
    icon: "fas fa-brain",
    title: "IA en la gestión",
    description:
      "Informes narrativos, chat del PDM y clasificación inteligente de trámites.",
    color: "#7c3aed",
  },
  {
    icon: "fas fa-chart-line",
    title: "Dashboards en vivo",
    description:
      "KPIs y gráficas interactivas para juntas, concejos y equipos de gestión.",
    color: "#1cc28e",
  },
  {
    icon: "fas fa-shield-alt",
    title: "Acceso seguro",
    description:
      "Clerk, roles por secretaría y entidad, con auditoría de accesos.",
    color: "#e74a3b",
  },
  {
    icon: "fas fa-comments",
    title: "Portal ciudadano",
    description:
      "PQRS con radicación con o sin cuenta y seguimiento del trámite.",
    color: "#36b9cc",
  },
  {
    icon: "fas fa-file-pdf",
    title: "Reportes al instante",
    description:
      "PDF ejecutivos con filtros por secretaría, año, estado y ODS.",
    color: "#ff9900",
  },
];

export const modules: Module[] = [
  {
    name: "Plan de Desarrollo Municipal",
    icon: "fas fa-map-marked-alt",
    description:
      "Estructura jerárquica del PDM, ejecución presupuestal, evidencias e informes con IA.",
    features: [
      "5 niveles: línea → sector → programa → producto → actividad",
      "Carga Excel de ejecución y contratos RPS",
      "Integración BPIN (datos.gov.co)",
      "Dashboard e informes PDF con IA",
      "Chat público del PDM por entidad",
    ],
    color: "#216ba8",
  },
  {
    name: "PQRS",
    icon: "fas fa-comments",
    description:
      "Ventanilla ciudadana con radicación personal o anónima y seguimiento del trámite.",
    features: [
      "Portal público por entidad",
      "Numeración automática de radicado",
      "Asignación a secretarías y funcionarios",
      "Clasificación asistida con IA",
      "Estadísticas por tipo y estado",
    ],
    color: "#1cc28e",
  },
  {
    name: "Planes Institucionales",
    icon: "fas fa-sitemap",
    description:
      "Componentes, procesos y actividades con control de avance por secretaría.",
    features: [
      "Plan → componente → proceso → actividad",
      "Estados y responsables por dependencia",
      "Seguimiento de cumplimiento",
      "Reportes por período y secretaría",
    ],
    color: "#f6c23e",
  },
  {
    name: "Contratación Pública",
    icon: "fas fa-file-contract",
    description:
      "Consulta SECOP I y II con análisis asistido por IA.",
    features: [
      "Integración datos.gov.co (SECOP I y II)",
      "Búsqueda por entidad, contratista y valor",
      "Análisis de contratos con OpenAI",
      "Caché Redis para consultas frecuentes",
    ],
    color: "#e74a3b",
  },
  {
    name: "Correspondencia Oficial",
    icon: "fas fa-mail-bulk",
    description:
      "Radicación física o electrónica con control de plazos y trazabilidad.",
    features: [
      "Numeración automática por entidad",
      "Asignación a dependencias",
      "Control de tiempos de respuesta",
      "Historial completo del trámite",
    ],
    color: "#858ae3",
  },
  {
    name: "Control de Asistencia",
    icon: "fas fa-user-clock",
    description:
      "Registro de entrada y salida con evidencia fotográfica.",
    features: [
      "Captura de foto al registrar",
      "Evidencias en la nube",
      "Estadísticas diarias y mensuales",
      "Panel de administración",
    ],
    color: "#36b9cc",
  },
];

export const benefits: Benefit[] = [
  {
    icon: "fas fa-rocket",
    title: "Listo para producción",
    description:
      "Docker, PostgreSQL, Redis y despliegue seguro con Cloudflare Tunnel.",
  },
  {
    icon: "fas fa-brain",
    title: "IA donde importa",
    description:
      "OpenAI en informes, PQRS y asistencia institucional — no como adorno.",
  },
  {
    icon: "fas fa-shield-alt",
    title: "Seguridad real",
    description:
      "Clerk + RBAC en Django, datos aislados por entidad y auditoría.",
  },
  {
    icon: "fas fa-building",
    title: "Una plataforma, varias entidades",
    description:
      "Roles diferenciados y configuración por organización sin mezclar datos.",
  },
];

export const useCases: UseCase[] = [
  {
    icon: "fas fa-city",
    title: "Alcaldías",
    description: "PDM, PQRS y contratación en el día a día municipal.",
    metrics: ["PDM 2024–2027", "Portal ciudadano", "Informes de rendición"],
  },
  {
    icon: "fas fa-landmark",
    title: "Gobernaciones",
    description: "Gestión multi-secretaría con reportes consolidados.",
    metrics: ["Planes por dependencia", "Correspondencia centralizada", "Control de asistencia"],
  },
  {
    icon: "fas fa-hospital",
    title: "Entidades descentralizadas",
    description: "ESEs, UMATAS y personerías con módulos a la medida.",
    metrics: ["PQRS propio", "Planes institucionales", "Dashboard integrado"],
  },
];

/** Stack real de app.softone360.com (Django + React). */
export const techStack: TechItem[] = [
  { name: "React 19", icon: "fab fa-react", color: "#61dafb" },
  { name: "TypeScript", icon: "fab fa-js", color: "#3178c6" },
  { name: "Vite", icon: "fas fa-bolt", color: "#646cff" },
  { name: "Tailwind CSS", icon: "fas fa-palette", color: "#06b6d4" },
  { name: "Django 5", icon: "fab fa-python", color: "#092e20" },
  { name: "DRF", icon: "fas fa-code", color: "#a30000" },
  { name: "PostgreSQL", icon: "fas fa-database", color: "#336791" },
  { name: "Redis", icon: "fas fa-memory", color: "#dc143c" },
  { name: "Clerk", icon: "fas fa-user-shield", color: "#6c47ff" },
  { name: "OpenAI", icon: "fas fa-brain", color: "#10a37f" },
  { name: "Recharts", icon: "fas fa-chart-pie", color: "#ff6384" },
  { name: "Docker", icon: "fab fa-docker", color: "#2496ed" },
  { name: "Cloudflare", icon: "fas fa-cloud", color: "#f38020" },
];

export const pdmCapabilities = [
  {
    icon: "fas fa-sitemap",
    gradient: "linear-gradient(135deg, #216ba8, #36b9cc)",
    title: "Estructura completa",
    text: "Línea → sector → programa → producto → actividad, con indicadores por año.",
  },
  {
    icon: "fas fa-brain",
    gradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "Informes con IA",
    text: "Narrativa automática del avance, logros y brechas del plan.",
  },
  {
    icon: "fas fa-chart-line",
    gradient: "linear-gradient(135deg, #1cc28e, #059669)",
    title: "Dashboard en vivo",
    text: "Gráficas para juntas y concejos con datos actualizados.",
  },
  {
    icon: "fas fa-file-excel",
    gradient: "linear-gradient(135deg, #ff9900, #f59e0b)",
    title: "Carga desde Excel",
    text: "Ejecución presupuestal y contratos RPS en un solo archivo.",
  },
];

export const pdmFeatures = [
  "Carga del PDM cuatrienal (2024–2027)",
  "Indicadores y avance por producto",
  "Ejecución: plan vs presupuesto vs pagos",
  "Integración BPIN en tiempo real",
  "Filtros por línea, ODS, secretaría y año",
  "PDF con IA y filtros avanzados",
];

export const pdmStats = [
  { icon: "fas fa-layer-group", value: "5 Niveles", label: "Jerarquía PDM" },
  { icon: "fas fa-calendar-alt", value: "4 Años", label: "2024–2027" },
  { icon: "fas fa-robot", value: "OpenAI", label: "Informes IA" },
  { icon: "fas fa-cloud", value: "Nube", label: "Evidencias" },
];

export const WHATSAPP_NUMBER = "573162987496";
export const CONTACT_EMAIL = "contactenos@softone360.com";
export const CONTACT_PHONE = "+57 316 298 7496";

export function contactWhatsApp(message: string): void {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
