import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileStack,
  FolderTree,
  FolderOpen,
  ClipboardList,
  ArrowRightLeft,
  BarChart3,
  Archive,
} from "lucide-react";
import { GdHeaderActionsProvider, useGdHeaderActions } from "./GdHeaderActionsContext";

const tabs = [
  { to: "/gestion-documental", end: true, label: "Resumen", icon: LayoutDashboard },
  { to: "/gestion-documental/instrumentos", end: false, label: "Instrumentos", icon: FileStack },
  { to: "/gestion-documental/clasificacion", end: false, label: "Clasificación", icon: FolderTree },
  { to: "/gestion-documental/expedientes", end: false, label: "Expedientes", icon: FolderOpen },
  { to: "/gestion-documental/inventario", end: false, label: "Inventario FUID", icon: ClipboardList },
  { to: "/gestion-documental/transferencias", end: false, label: "Transferencias", icon: ArrowRightLeft },
  { to: "/gestion-documental/informes", end: false, label: "Informes", icon: BarChart3 },
];

function GestionDocumentalLayoutInner() {
  const location = useLocation();
  const { headerActions } = useGdHeaderActions();
  const isDetail = Boolean(location.pathname.match(/\/gestion-documental\/expedientes\/\d+/));

  const subtitle = isDetail
    ? "Detalle del expediente y hoja de control"
    : location.pathname.includes("/instrumentos")
      ? "Instrumentos archivísticos AGN (CCD, TRD, TVD, PGD, FUID…)"
      : location.pathname.includes("/clasificacion")
        ? "Cuadro de clasificación y tablas de retención"
        : location.pathname.includes("/expedientes")
          ? "Expedientes electrónicos y documentos de archivo"
          : location.pathname.includes("/inventario")
            ? "Formato Único de Inventario Documental (FUID)"
            : location.pathname.includes("/transferencias")
              ? "Transferencias primarias y secundarias"
              : location.pathname.includes("/informes")
                ? "Exportaciones Excel (FUID, TRD, transferencias)"
                : "SGDEA conforme Ley 594 y Acuerdo AGN 001 de 2024";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Gestión documental</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          </div>
        </div>
        {headerActions && <div className="flex flex-wrap items-center gap-2">{headerActions}</div>}
      </div>

      {!isDetail && (
        <nav className="flex flex-wrap gap-1 border-b border-slate-200">
          {tabs.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                  isActive
                    ? "border-[#3eafd4] text-[#0e7490]"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      <Outlet />
    </div>
  );
}

export default function GestionDocumentalLayout() {
  return (
    <GdHeaderActionsProvider>
      <GestionDocumentalLayoutInner />
    </GdHeaderActionsProvider>
  );
}
