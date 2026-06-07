export interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

export interface Capability {
  icon: string;
  title: string;
  desc: string;
  gradient: string;
}

export interface Module {
  name: string;
  icon: string;
  description: string;
  features: string[];
  color: string;
  capabilities?: Capability[];
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
  { value: "6+", label: "Módulos Integrados", icon: "fas fa-cubes" },
  { value: "360°", label: "Gestión Pública Total", icon: "fas fa-sync-alt" },
  { value: "Multi", label: "Entidad y Roles", icon: "fas fa-building" },
  { value: "IA", label: "OpenAI Integrado", icon: "fas fa-brain" },
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
    sub: "OpenAI integrado en informes",
    gradient: "linear-gradient(135deg,#7c3aed,#a855f7)",
  },
  {
    icon: "fas fa-file-pdf",
    title: "Informes PDF",
    sub: "Generación automática async",
    gradient: "linear-gradient(135deg,#e74a3b,#f97316)",
  },
  {
    icon: "fas fa-shield-alt",
    title: "Acceso Seguro",
    sub: "Clerk + roles y permisos",
    gradient: "linear-gradient(135deg,#ff9900,#f59e0b)",
  },
  {
    icon: "fas fa-users",
    title: "Multi-Entidad",
    sub: "Módulos por organización",
    gradient: "linear-gradient(135deg,#1cc28e,#059669)",
  },
];

export const features: Feature[] = [
  {
    icon: "fas fa-map-marked-alt",
    title: "PDM 360° Inteligente",
    description:
      "Seguimiento completo del Plan de Desarrollo Municipal: líneas estratégicas, productos, actividades, indicadores y ejecución presupuestal en un solo lugar.",
    color: "#216ba8",
  },
  {
    icon: "fas fa-brain",
    title: "IA Generativa con OpenAI",
    description:
      "Informes ejecutivos con análisis narrativo, chat público del PDM y asistencia inteligente para la toma de decisiones institucionales.",
    color: "#7c3aed",
  },
  {
    icon: "fas fa-chart-line",
    title: "Analytics en Tiempo Real",
    description:
      "Dashboards interactivos con Recharts, KPIs personalizables, comparativas presupuestales multi-año y visualizaciones para rendición de cuentas.",
    color: "#1cc28e",
  },
  {
    icon: "fas fa-shield-alt",
    title: "Seguridad Empresarial",
    description:
      "Autenticación Clerk, RBAC granular en Django, control por entidad y secretaría, auditoría de accesos y cumplimiento normativo.",
    color: "#e74a3b",
  },
  {
    icon: "fas fa-cloud-upload-alt",
    title: "Almacenamiento en la Nube",
    description:
      "Evidencias fotográficas, documentos y archivos Excel en almacenamiento object storage con acceso controlado por entidad.",
    color: "#ff9900",
  },
  {
    icon: "fas fa-comments",
    title: "Portal Ciudadano PQRS",
    description:
      "Ventanilla única pública por entidad. Radicación con o sin cuenta, seguimiento de trámites y notificaciones al ciudadano.",
    color: "#36b9cc",
  },
  {
    icon: "fas fa-file-pdf",
    title: "Informes PDF Automáticos",
    description:
      "Generación de informes ejecutivos y reportes de gestión en PDF con filtros por secretaría, año, estado y ODS.",
    color: "#e74a3b",
  },
  {
    icon: "fas fa-database",
    title: "Caché Redis y Rendimiento",
    description:
      "Redis para consultas frecuentes, paginación eficiente y APIs optimizadas con Django REST Framework.",
    color: "#dc143c",
  },
  {
    icon: "fas fa-users-cog",
    title: "Gestión Multiusuario",
    description:
      "Roles diferenciados: Superadmin, Admin, Secretario y Ciudadano. Control de acceso por secretaría, entidad y módulo.",
    color: "#858ae3",
  },
];

export const modules: Module[] = [
  {
    name: "Plan de Desarrollo Municipal (PDM)",
    icon: "fas fa-map-marked-alt",
    description:
      "Gestión integral del PDM con Líneas Estratégicas → Sectores → Programas → Productos → Actividades. Ejecución presupuestal, contratos RPS, integración BPIN, evidencias e informes con IA.",
    features: [
      "Líneas estratégicas, sectores y programas",
      "Productos e indicadores por año (2024–2027)",
      "Actividades con responsable por secretaría",
      "Ejecución presupuestal desde Excel (.xlsx)",
      "Contratos RPS cargados desde archivo",
      "Integración BPIN – datos.gov.co",
      "Evidencias fotográficas en la nube",
      "Informes PDF ejecutivos con IA generativa",
      "Dashboard interactivo con Recharts",
      "Chat IA público del PDM por entidad",
    ],
    color: "#216ba8",
    capabilities: [
      {
        icon: "fas fa-sitemap",
        title: "Estructura Jerárquica",
        desc: "5 niveles: Líneas → Sectores → Programas → Productos → Actividades con indicadores.",
        gradient: "linear-gradient(135deg,#216ba8,#36b9cc)",
      },
      {
        icon: "fas fa-brain",
        title: "IA Generativa OpenAI",
        desc: "Informes ejecutivos con narrativa automática, análisis de brechas y logros.",
        gradient: "linear-gradient(135deg,#7c3aed,#a855f7)",
      },
      {
        icon: "fas fa-file-pdf",
        title: "Informes PDF Asíncronos",
        desc: "Reportes filtrables por secretaría, año, estado y ODS incluidos.",
        gradient: "linear-gradient(135deg,#e74a3b,#dc2626)",
      },
    ],
  },
  {
    name: "PQRS y Peticiones Ciudadanas",
    icon: "fas fa-comments",
    description:
      "Sistema completo de Peticiones, Quejas, Reclamos y Sugerencias con portal ciudadano. Radicación personal y anónima, asignación a funcionarios y seguimiento en tiempo real.",
    features: [
      "Radicación personal y anónima",
      "Portal Ventanilla Única Ciudadana",
      "Numeración automática de radicado",
      "Asignación a secretarías y funcionarios",
      "Seguimiento en tiempo real del trámite",
      "Clasificación asistida con IA",
      "Reportes estadísticos por tipo y estado",
      "Auditoría completa de asignaciones",
    ],
    color: "#1cc28e",
    capabilities: [
      {
        icon: "fas fa-inbox",
        title: "Radicación Inteligente",
        desc: "Personal y anónima con numeración única automática por entidad y período.",
        gradient: "linear-gradient(135deg,#1cc28e,#059669)",
      },
      {
        icon: "fas fa-robot",
        title: "Clasificación con IA",
        desc: "Extracción y categorización automática desde texto o documentos adjuntos.",
        gradient: "linear-gradient(135deg,#36b9cc,#0891b2)",
      },
      {
        icon: "fas fa-chart-pie",
        title: "Dashboard Estadístico",
        desc: "Análisis en tiempo real por tipo, estado, funcionario y período de gestión.",
        gradient: "linear-gradient(135deg,#f6c23e,#d97706)",
      },
    ],
  },
  {
    name: "Planes Institucionales",
    icon: "fas fa-sitemap",
    description:
      "Gestión de planes institucionales con componentes, procesos y actividades. Control de ejecución por secretaría y cumplimiento de metas.",
    features: [
      "Planes con componentes y procesos",
      "Actividades con responsable por secretaría",
      "Ejecución y seguimiento de avances",
      "Estados: pendiente / en progreso / completado",
      "Reportes de cumplimiento institucional",
      "Control granular por secretaría",
    ],
    color: "#f6c23e",
    capabilities: [
      {
        icon: "fas fa-layer-group",
        title: "Estructura Modular",
        desc: "Plan → Componente → Proceso → Actividad con estados, fechas y responsables.",
        gradient: "linear-gradient(135deg,#f6c23e,#d97706)",
      },
      {
        icon: "fas fa-user-tie",
        title: "Control por Secretaría",
        desc: "Cada secretaría gestiona sus actividades con permisos granulares.",
        gradient: "linear-gradient(135deg,#216ba8,#2563eb)",
      },
      {
        icon: "fas fa-chart-bar",
        title: "Reportes de Cumplimiento",
        desc: "Avance por componente, período y secretaría para rendición de cuentas.",
        gradient: "linear-gradient(135deg,#1cc28e,#059669)",
      },
    ],
  },
  {
    name: "Contratación Pública",
    icon: "fas fa-file-contract",
    description:
      "Consulta y análisis de contratación pública con integración a datos.gov.co. SECOP I y SECOP II con análisis asistido por IA.",
    features: [
      "Integración SECOP I – datos.gov.co",
      "Integración SECOP II – datos.gov.co",
      "Consulta de procesos y contratos",
      "Análisis con IA OpenAI",
      "Caché Redis para consultas rápidas",
      "Búsqueda por entidad, contratista y valor",
    ],
    color: "#e74a3b",
    capabilities: [
      {
        icon: "fas fa-database",
        title: "SECOP I & II en Vivo",
        desc: "Integración directa con datos.gov.co. Contratos y procesos actualizados.",
        gradient: "linear-gradient(135deg,#e74a3b,#dc2626)",
      },
      {
        icon: "fas fa-brain",
        title: "Análisis IA OpenAI",
        desc: "Revisión inteligente de contratos, cuantías, contratistas y objetos contractuales.",
        gradient: "linear-gradient(135deg,#7c3aed,#a855f7)",
      },
      {
        icon: "fas fa-tachometer-alt",
        title: "Caché Redis",
        desc: "Consultas rápidas con caché inteligente y rate limiting por usuario.",
        gradient: "linear-gradient(135deg,#dc143c,#b91c1c)",
      },
    ],
  },
  {
    name: "Correspondencia Oficial",
    icon: "fas fa-mail-bulk",
    description:
      "Gestión documental para correspondencia oficial. Radicación física o electrónica, numeración automática y control de tiempos de respuesta.",
    features: [
      "Radicación física y electrónica",
      "Numeración automática de radicado",
      "Seguimiento de estado del trámite",
      "Asignación a dependencias",
      "Control de tiempos de respuesta",
      "Historial completo por entidad",
    ],
    color: "#858ae3",
    capabilities: [
      {
        icon: "fas fa-barcode",
        title: "Radicado Automático",
        desc: "Numeración única generada automáticamente por entidad.",
        gradient: "linear-gradient(135deg,#858ae3,#6366f1)",
      },
      {
        icon: "fas fa-clock",
        title: "Control de Tiempos",
        desc: "Seguimiento de plazos con alertas por vencimiento de términos.",
        gradient: "linear-gradient(135deg,#f6c23e,#d97706)",
      },
      {
        icon: "fas fa-history",
        title: "Historial Trazable",
        desc: "Auditoría completa de estados, asignaciones y responsables.",
        gradient: "linear-gradient(135deg,#36b9cc,#0891b2)",
      },
    ],
  },
  {
    name: "Control de Asistencia",
    icon: "fas fa-user-clock",
    description:
      "Control de asistencia del talento humano con registro fotográfico. Captura de imagen, almacenamiento seguro y estadísticas por funcionario.",
    features: [
      "Registro con foto en tiempo real",
      "Almacenamiento seguro de evidencias",
      "Registro de entrada y salida",
      "Estadísticas diarias y mensuales",
      "Validación por equipo de registro",
      "Panel de administración de funcionarios",
    ],
    color: "#36b9cc",
    capabilities: [
      {
        icon: "fas fa-camera",
        title: "Foto en Tiempo Real",
        desc: "Captura fotográfica al momento del registro de entrada o salida.",
        gradient: "linear-gradient(135deg,#36b9cc,#0891b2)",
      },
      {
        icon: "fas fa-cloud",
        title: "Evidencias en la Nube",
        desc: "Fotos indexadas por fecha con acceso controlado por entidad.",
        gradient: "linear-gradient(135deg,#216ba8,#2563eb)",
      },
      {
        icon: "fas fa-chart-bar",
        title: "Estadísticas y Reportes",
        desc: "Reportes de asistencia diaria, mensual y por funcionario.",
        gradient: "linear-gradient(135deg,#1cc28e,#059669)",
      },
    ],
  },
];

export const benefits: Benefit[] = [
  {
    icon: "fas fa-rocket",
    title: "Despliegue Productivo",
    description:
      "Stack Docker con Nginx, PostgreSQL, Redis y publicación segura vía Cloudflare Tunnel. Alta disponibilidad y mantenimiento simplificado.",
  },
  {
    icon: "fas fa-brain",
    title: "IA en cada Módulo",
    description:
      "Integración nativa con OpenAI para informes narrativos, clasificación de PQRS, chat del PDM y asistencia en gestión institucional.",
  },
  {
    icon: "fas fa-shield-alt",
    title: "Seguridad de Nivel Empresarial",
    description:
      "Autenticación Clerk, RBAC Django, rate limiting, auditoría de accesos y almacenamiento cifrado para el sector público.",
  },
  {
    icon: "fas fa-chart-bar",
    title: "Reportes Ejecutivos Automáticos",
    description:
      "Generación de informes PDF con visualizaciones de cumplimiento, comparativas presupuestales multi-año y filtros avanzados.",
  },
  {
    icon: "fas fa-building",
    title: "Multi-Entidad y Multi-Rol",
    description:
      "Una plataforma para múltiples entidades. Datos aislados, roles diferenciados y personalización por organización.",
  },
  {
    icon: "fas fa-bolt",
    title: "Alto Rendimiento",
    description:
      "Caché Redis, APIs optimizadas con DRF, paginación eficiente y carga diferida para grandes volúmenes de datos.",
  },
];

export const useCases: UseCase[] = [
  {
    icon: "fas fa-city",
    title: "Alcaldías Municipales",
    description:
      "Gestión del PDM cuatrienal, PQRS ciudadanas, contratación pública y correspondencia oficial en una sola plataforma municipal.",
    metrics: [
      "PDM con seguimiento 2024–2027",
      "PQRS con portal ciudadano",
      "Contratación SECOP I y II",
      "Informes para rendición de cuentas",
    ],
  },
  {
    icon: "fas fa-landmark",
    title: "Gobernaciones y Departamentos",
    description:
      "Control multi-secretaría, planes de desarrollo departamental, correspondencia masiva y reportes consolidados.",
    metrics: [
      "Gestión multi-secretaría",
      "Planes institucionales por dependencia",
      "Correspondencia oficial centralizada",
      "Control de asistencia del talento humano",
    ],
  },
  {
    icon: "fas fa-hospital",
    title: "Entidades Descentralizadas",
    description:
      "ESEs, UMATAS, Personerías y entidades descentralizadas con PQRS, correspondencia y planes institucionales.",
    metrics: [
      "Portal ciudadano propio",
      "Planes institucionales específicos",
      "Seguimiento en tiempo real",
      "Dashboard de gestión integrado",
    ],
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
    title: "Estructura Jerárquica",
    text: "Líneas estratégicas → Sectores → Programas → Productos → Actividades. Toda la cadena del valor del PDM en un solo lugar.",
  },
  {
    icon: "fas fa-brain",
    gradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    title: "IA Generativa OpenAI",
    text: "Genera informes ejecutivos narrativos con análisis inteligente del avance, logros y brechas del PDM.",
  },
  {
    icon: "fas fa-chart-line",
    gradient: "linear-gradient(135deg, #1cc28e, #059669)",
    title: "Dashboard Interactivo",
    text: "Gráficas en tiempo real con Recharts: barras, dona, radial y comparativas para juntas y concejos.",
  },
  {
    icon: "fas fa-file-excel",
    gradient: "linear-gradient(135deg, #ff9900, #f59e0b)",
    title: "Carga Excel Presupuestal",
    text: "Importa la ejecución presupuestal y contratos RPS directamente desde archivos .xlsx.",
  },
  {
    icon: "fas fa-file-pdf",
    gradient: "linear-gradient(135deg, #e74a3b, #dc2626)",
    title: "Informes PDF Automáticos",
    text: "Generación asíncrona de informes. Filtra por secretaría, estado, año y ODS.",
  },
  {
    icon: "fas fa-camera",
    gradient: "linear-gradient(135deg, #36b9cc, #0891b2)",
    title: "Evidencias Fotográficas",
    text: "Registro fotográfico de actividades ejecutadas almacenado en la nube con acceso controlado.",
  },
];

export const pdmFeatures = [
  "Carga Excel del PDM cuatrienal (2024–2027)",
  "Indicadores de resultado por producto y año",
  "Actividades con responsable por secretaría",
  "Ejecución presupuestal: PDM vs Ppto Definitivo vs Pagos",
  "Contratos RPS: carga desde archivo Excel",
  "Integración BPIN desde datos.gov.co en tiempo real",
  "Iniciativas SGR con estado de gestión",
  "Filtros: línea / sector / ODS / secretaría / año",
  "Análisis de producto con avance por año",
  "Informes PDF con filtros avanzados y IA narrativa",
];

export const pdmStats = [
  { icon: "fas fa-map-marked-alt", value: "PDM", label: "Módulo Estrella" },
  { icon: "fas fa-layer-group", value: "5 Niveles", label: "Estructura Jerárquica" },
  { icon: "fas fa-calendar-alt", value: "4 Años", label: "Seguimiento 2024–2027" },
  { icon: "fas fa-robot", value: "OpenAI", label: "Informes con IA" },
  { icon: "fas fa-cloud", value: "Nube", label: "Evidencias seguras" },
];

export const WHATSAPP_NUMBER = "573162987496";
export const CONTACT_EMAIL = "contactenos@softone360.com";
export const CONTACT_PHONE = "+57 316 298 7496";

export function contactWhatsApp(message: string): void {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
