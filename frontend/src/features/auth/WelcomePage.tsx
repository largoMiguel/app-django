import { Link, Navigate } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  Mail,
  Users,
  type LucideIcon,
} from "lucide-react";
import { accessibleNavRoutes, primaryRole, useAuthStore } from "@/core/auth/store";

const MODULE_META: Record<
  string,
  { description: string; icon: LucideIcon; accent: string; iconBg: string }
> = {
  pqrs: {
    description: "Radicación, asignación y respuesta de peticiones ciudadanas.",
    icon: FileText,
    accent: "border-l-[#1cc28e]",
    iconBg: "bg-[#1cc28e]",
  },
  pdm: {
    description: "Seguimiento al Plan de Desarrollo, productos, ejecución e informes.",
    icon: BarChart3,
    accent: "border-l-[#216ba8]",
    iconBg: "bg-[#216ba8]",
  },
  planes_institucionales: {
    description: "Planes Decreto 612: avance, cronograma e informes por vigencia.",
    icon: ClipboardList,
    accent: "border-l-[#d97706]",
    iconBg: "bg-[#d97706]",
  },
  asistencia: {
    description: "Control de entrada y salida de funcionarios.",
    icon: Clock,
    accent: "border-l-[#36b9cc]",
    iconBg: "bg-[#36b9cc]",
  },
  correspondencia: {
    description: "Radicación de correspondencia de entrada y salida.",
    icon: Mail,
    accent: "border-l-[#6366f1]",
    iconBg: "bg-[#6366f1]",
  },
  gestion_documental: {
    description: "Instrumentos archivísticos, expedientes e inventario FUID.",
    icon: Archive,
    accent: "border-l-[#0f766e]",
    iconBg: "bg-[#0f766e]",
  },
  contratacion: {
    description: "Contratos y procesos de SECOP I y SECOP II.",
    icon: FileSearch,
    accent: "border-l-[#e74a3b]",
    iconBg: "bg-[#e74a3b]",
  },
  users_admin: {
    description: "Usuarios, roles y módulos de la entidad.",
    icon: Users,
    accent: "border-l-[#64748b]",
    iconBg: "bg-[#64748b]",
  },
  superadmin: {
    description: "Crear y configurar entidades, módulos y accesos.",
    icon: Building2,
    accent: "border-l-[#3eafd4]",
    iconBg: "bg-[#3eafd4]",
  },
};

function greetingForHour(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function WelcomePage() {
  const user = useAuthStore((s) => s.user);
  const routes = accessibleNavRoutes(user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (routes.length === 0) {
    return <Navigate to="/sin-acceso" replace />;
  }

  const entity = user.entity;
  const role = primaryRole(user) || user.roles[0] || "Usuario";
  const displayName = user.full_name?.trim() || user.email;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#3eafd4]">{greetingForHour()}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {entity?.name ? (
              <>
                <span className="font-medium text-slate-700">{entity.name}</span>
                <span className="mx-1.5 text-slate-300">·</span>
              </>
            ) : null}
            <span className="capitalize">{role}</span>
          </p>
        </div>
        {entity?.logo_url ? (
          <img
            src={entity.logo_url}
            alt={entity.name}
            className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-cover shadow-sm"
          />
        ) : null}
      </div>

      <p className="mb-4 text-sm font-semibold text-slate-600">
        Seleccione un módulo para continuar
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {routes.map((item) => {
          const meta = MODULE_META[item.moduleKey] ?? MODULE_META.pqrs;
          const Icon = meta.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex flex-col rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${meta.accent}`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${meta.iconBg}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#3eafd4]" />
              </div>
              <h2 className="text-base font-semibold text-slate-800">{item.label}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{meta.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
