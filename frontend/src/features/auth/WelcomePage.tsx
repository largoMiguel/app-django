import { Link, Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  LayoutGrid,
  Mail,
  Moon,
  Sparkles,
  Sun,
  Sunset,
  Users,
  type LucideIcon,
} from "lucide-react";
import { accessibleNavRoutes, primaryRole, useAuthStore } from "@/core/auth/store";

const MODULE_META: Record<
  string,
  { description: string; icon: LucideIcon; accent: string; iconBg: string; glow: string }
> = {
  pqrs: {
    description: "Radicación, asignación y respuesta de peticiones ciudadanas.",
    icon: FileText,
    accent: "border-l-[#1cc28e]",
    iconBg: "bg-[#1cc28e]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(28,194,142,0.45)]",
  },
  pdm: {
    description: "Seguimiento al Plan de Desarrollo, productos, ejecución e informes.",
    icon: BarChart3,
    accent: "border-l-[#216ba8]",
    iconBg: "bg-[#216ba8]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(33,107,168,0.45)]",
  },
  planes_institucionales: {
    description: "Planes Decreto 612: avance, cronograma e informes por vigencia.",
    icon: ClipboardList,
    accent: "border-l-[#d97706]",
    iconBg: "bg-[#d97706]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(217,119,6,0.4)]",
  },
  asistencia: {
    description: "Control de entrada y salida de funcionarios.",
    icon: Clock,
    accent: "border-l-[#36b9cc]",
    iconBg: "bg-[#36b9cc]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(54,185,204,0.45)]",
  },
  correspondencia: {
    description: "Radicación de correspondencia de entrada y salida.",
    icon: Mail,
    accent: "border-l-[#6366f1]",
    iconBg: "bg-[#6366f1]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(99,102,241,0.45)]",
  },
  gestion_documental: {
    description: "Instrumentos archivísticos, expedientes e inventario FUID.",
    icon: Archive,
    accent: "border-l-[#0f766e]",
    iconBg: "bg-[#0f766e]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(15,118,110,0.45)]",
  },
  contratacion: {
    description: "Contratos y procesos de SECOP I y SECOP II.",
    icon: FileSearch,
    accent: "border-l-[#e74a3b]",
    iconBg: "bg-[#e74a3b]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(231,74,59,0.4)]",
  },
  users_admin: {
    description: "Usuarios, roles y módulos de la entidad.",
    icon: Users,
    accent: "border-l-[#64748b]",
    iconBg: "bg-[#64748b]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(100,116,139,0.35)]",
  },
  superadmin: {
    description: "Crear y configurar entidades, módulos y accesos.",
    icon: Building2,
    accent: "border-l-[#3eafd4]",
    iconBg: "bg-[#3eafd4]",
    glow: "group-hover:shadow-[0_12px_40px_-12px_rgba(62,175,212,0.45)]",
  },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  secretario: "Secretario",
  contratista: "Contratista",
  ciudadano: "Ciudadano",
  superadmin: "Superadmin",
  auditor: "Auditor",
};

function greetingForHour(date = new Date()): { text: string; Icon: LucideIcon } {
  const hour = date.getHours();
  if (hour < 12) return { text: "Buenos días", Icon: Sun };
  if (hour < 19) return { text: "Buenas tardes", Icon: Sunset };
  return { text: "Buenas noches", Icon: Moon };
}

const heroEase = [0.22, 1, 0.36, 1] as const;

export default function WelcomePage() {
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const routes = accessibleNavRoutes(user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (routes.length === 0) {
    return <Navigate to="/sin-acceso" replace />;
  }

  const entity = user.entity;
  const roleKey = primaryRole(user) || user.roles[0] || "usuario";
  const roleLabel = ROLE_LABELS[roleKey] ?? roleKey;
  const displayName = user.full_name?.trim() || user.email;
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const { text: greeting, Icon: GreetingIcon } = greetingForHour();

  const fadeUp = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: heroEase },
        };

  const cardMotion = (index: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 22, scale: 0.97 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.45, delay: 0.12 + index * 0.07, ease: heroEase },
          whileHover: { y: -6, transition: { duration: 0.2 } },
          whileTap: { scale: 0.98 },
        };

  return (
    <div className="mx-auto max-w-5xl">
      <motion.section
        {...fadeUp(0)}
        className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#3eafd4]/10 via-white to-[#216ba8]/8"
          aria-hidden
        />
        <div
          className="welcome-orb pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#3eafd4]/20 blur-3xl"
          aria-hidden
        />
        <div
          className="welcome-orb-delayed pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-[#216ba8]/15 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <div className="min-w-0 flex-1">
            <motion.div
              {...fadeUp(0.05)}
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#3eafd4]/25 bg-[#3eafd4]/10 px-3 py-1.5 text-sm font-medium"
            >
              <motion.span
                animate={reduceMotion ? undefined : { rotate: [0, 8, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <GreetingIcon className="h-4 w-4 text-[#2a9fbf]" />
              </motion.span>
              <span className="welcome-shimmer-text">{greeting}</span>
            </motion.div>

            <motion.h1
              {...fadeUp(0.1)}
              className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem] sm:leading-tight"
            >
              {firstName}
              <motion.span
                {...fadeUp(0.18)}
                className="mt-1 block text-base font-normal text-slate-500 sm:text-lg"
              >
                Bienvenido a SoftOne 360
              </motion.span>
            </motion.h1>

            <motion.div
              {...fadeUp(0.22)}
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              {entity?.name ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm">
                  <Building2 className="h-3.5 w-3.5 text-[#3eafd4]" />
                  {entity.name}
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm capitalize text-slate-600">
                {roleLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#3eafd4]/20 bg-[#3eafd4]/5 px-3 py-1.5 text-sm font-medium text-[#2a9fbf]">
                <LayoutGrid className="h-3.5 w-3.5" />
                {routes.length} {routes.length === 1 ? "módulo" : "módulos"}
              </span>
            </motion.div>
          </div>

          {entity?.logo_url ? (
            <motion.div
              {...fadeUp(0.15)}
              className="relative shrink-0"
            >
              <div
                className="welcome-logo-ring absolute -inset-2 rounded-2xl bg-[#3eafd4]/25"
                aria-hidden
              />
              <motion.img
                src={entity.logo_url}
                alt={entity.name}
                className="relative h-20 w-20 rounded-2xl border-2 border-white bg-white object-cover shadow-lg sm:h-24 sm:w-24"
                whileHover={reduceMotion ? undefined : { scale: 1.04, rotate: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
              />
            </motion.div>
          ) : (
            <motion.div
              {...fadeUp(0.15)}
              className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-gradient-to-br from-[#3eafd4] to-[#216ba8] text-2xl font-bold text-white shadow-lg sm:h-24 sm:w-24"
              whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            >
              {(entity?.name ?? "S1").charAt(0).toUpperCase()}
            </motion.div>
          )}
        </div>
      </motion.section>

      <motion.div
        {...fadeUp(0.28)}
        className="mb-5 flex items-center gap-2"
      >
        <Sparkles className="h-4 w-4 text-[#3eafd4]" />
        <p className="text-sm font-semibold text-slate-700">
          Seleccione un módulo para continuar
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {routes.map((item, index) => {
          const meta = MODULE_META[item.moduleKey] ?? MODULE_META.pqrs;
          const Icon = meta.icon;
          return (
            <motion.div key={item.path} {...cardMotion(index)}>
              <Link
                to={item.path}
                className={`group flex h-full flex-col rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition-all duration-300 hover:border-slate-300 ${meta.accent} ${meta.glow}`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <motion.div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md ${meta.iconBg}`}
                    whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: -4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#3eafd4]" />
                </div>
                <h2 className="text-base font-semibold text-slate-800 transition-colors group-hover:text-slate-900">
                  {item.label}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 transition-colors group-hover:text-slate-600">
                  {meta.description}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
