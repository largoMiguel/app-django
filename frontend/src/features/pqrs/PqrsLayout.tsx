import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, FileText, LayoutDashboard } from "lucide-react";
import ModuleAIAlertsBanner from "@/components/ai/ModuleAIAlertsBanner";
import PqrsAICommandBar from "@/components/ai/PqrsAICommandBar";
import { useAuthStore } from "@/core/auth/store";
import { canAccessModuleRoute } from "@/core/auth/routes";
import { PqrsHeaderActionsProvider, usePqrsHeaderActions } from "./PqrsHeaderActionsContext";

const tabsBase = [
  { to: "/pqrs", end: true, label: "Resumen", icon: LayoutDashboard },
  { to: "/pqrs/solicitudes", end: false, label: "Solicitudes", icon: FileText },
] as const;

function PqrsLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { headerActions } = usePqrsHeaderActions();

  const showInformesTab = canAccessModuleRoute(user, "reports_pdf");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const nueva = params.get("nueva");
    if (id && /^\d+$/.test(id)) {
      navigate(`/pqrs/${id}`, { replace: true });
      return;
    }
    if (nueva === "1") {
      navigate("/pqrs/nueva", { replace: true });
    }
  }, [location.search, navigate]);

  const path = location.pathname;
  const isDetailOrForm =
    /\/pqrs\/\d+/.test(path) || path === "/pqrs/nueva" || path.endsWith("/editar");

  const subtitle = path.includes("/solicitudes")
    ? "Listado y gestión de solicitudes"
    : path.includes("/informes")
      ? "Generación y descarga de informes PDF"
      : path === "/pqrs/nueva"
        ? "Registrar nueva solicitud"
        : path.endsWith("/editar")
          ? "Editar datos de la solicitud"
          : /\/pqrs\/\d+/.test(path)
            ? "Detalle y seguimiento de la solicitud"
            : "Indicadores y análisis del módulo PQRS";

  const tabs = [
    ...tabsBase,
    ...(showInformesTab
      ? [{ to: "/pqrs/informes" as const, end: false as const, label: "Informes" as const, icon: BarChart3 }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <ModuleAIAlertsBanner
        module="pqrs"
        onAlertClick={(a) => a.object_id && navigate(`/pqrs/${a.object_id}`)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">PQRS</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          </div>
        </div>
        {isDetailOrForm && headerActions ? (
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        ) : null}
      </div>

      {!isDetailOrForm && (
        <div className="flex flex-col gap-2 border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between">
          <nav className="flex flex-wrap gap-1">
            {tabs.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-[#3eafd4] text-[#0e7490]"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          {headerActions ? (
            <div className="flex flex-wrap items-center gap-2 pb-2 sm:pb-2.5">{headerActions}</div>
          ) : null}
        </div>
      )}

      {path.includes("/solicitudes") && (
        <PqrsAICommandBar onResultClick={(r) => navigate(`/pqrs/${r.object_id}`)} />
      )}

      <Outlet />
    </div>
  );
}

export default function PqrsLayout() {
  return (
    <PqrsHeaderActionsProvider>
      <PqrsLayoutInner />
    </PqrsHeaderActionsProvider>
  );
}
