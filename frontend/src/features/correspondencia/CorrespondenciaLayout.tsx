import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Inbox, Mail, FileStack, LayoutDashboard, BarChart3 } from "lucide-react";

const tabs = [
  { to: "/correspondencia", end: true, label: "Resumen", icon: LayoutDashboard },
  { to: "/correspondencia/entrada", end: false, label: "Entrada", icon: Inbox },
  { to: "/correspondencia/salida", end: false, label: "Salida", icon: Mail },
  { to: "/correspondencia/todas", end: false, label: "Todas", icon: FileStack },
  { to: "/correspondencia/informes", end: false, label: "Informes", icon: BarChart3 },
];

export default function CorrespondenciaLayout() {
  const location = useLocation();
  const subtitle = location.pathname.includes("/entrada")
    ? "Radicados de correspondencia entrante"
    : location.pathname.includes("/salida")
      ? "Radicados de correspondencia saliente"
      : location.pathname.includes("/todas")
        ? "Todos los radicados de la entidad"
        : location.pathname.includes("/informes")
          ? "Exportación Excel y PDF"
          : location.pathname.match(/\/correspondencia\/\d+/)
            ? "Detalle del radicado"
            : "Ventanilla oficial — entrada y salida";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Correspondencia</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
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

      <Outlet />
    </div>
  );
}
