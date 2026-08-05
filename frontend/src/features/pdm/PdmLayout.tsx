import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, BarChart3, CheckCircle2, CloudUpload, FileBarChart2, FileSpreadsheet, FolderKanban, Layers, LayoutDashboard } from "lucide-react";
import PdmAccionesMenu from "@/features/pdm/PdmAccionesMenu";
import { PdmProvider, usePdm } from "@/features/pdm/PdmContext";
import PdmSharedModals from "@/features/pdm/PdmSharedModals";
import { ANIOS_PDM } from "@/features/pdm/pdmUtils";
import { pdmBtnPrimary, pdmBtnSecondary, pdmSelect } from "@/features/pdm/pdmStyles";
import { PdmAlert, PdmCard, PdmLoadingOverlay } from "@/features/pdm/components/PdmUi";

const baseTabs: Array<{
  to: string;
  end: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: readonly ("admin" | "secretario")[];
}> = [
  { to: "/pdm", end: true, label: "Resumen", icon: LayoutDashboard },
  { to: "/pdm/productos", end: false, label: "Productos", icon: FileSpreadsheet },
  { to: "/pdm/analisis", end: false, label: "Análisis", icon: BarChart3 },
  { to: "/pdm/proyectos", end: false, label: "Proyectos", icon: FolderKanban },
  { to: "/pdm/informes", end: false, label: "Informes", icon: FileBarChart2, roles: ["admin", "secretario"] as const },
];

function PdmLayoutInner() {
  const location = useLocation();
  const {
    route,
    tieneDatos,
    loading,
    isAdmin,
    isSecretario,
    saving,
    error,
    uploadFeedback,
    setUploadFeedback,
    filtroAnio,
    setFiltroAnio,
    triggerRecargarPdm,
    handleExportarPiip,
    setModalContratos,
    setModalEjecucion,
    volverDesdeDetalle,
  } = usePdm();

  const isDetail = route === "detalle";
  const tabs = baseTabs.filter((tab) => {
    if (!tab.roles) return true;
    return (isAdmin && tab.roles.includes("admin")) || (isSecretario && tab.roles.includes("secretario"));
  });

  const subtitle = !tieneDatos
    ? isAdmin
      ? "Cargue el Excel del plan indicativo (5 hojas)"
      : "El administrador debe cargar el plan indicativo de la entidad"
    : isDetail
      ? "Detalle, actividades y ejecución del producto"
      : location.pathname.includes("/productos")
        ? "Consulta y filtrado de productos por año"
        : location.pathname.includes("/analisis")
          ? "Dashboard analítico del Plan de Desarrollo Municipal"
          : location.pathname.includes("/proyectos")
            ? "Proyectos de inversión unificados por BPIN y sus productos del Plan Indicativo"
            : location.pathname.includes("/informes")
              ? "Informes PDF del Plan de Desarrollo Municipal — generación y historial (retención 7 días)"
                : isSecretario && !isAdmin
              ? "Productos asignados a su secretaría"
              : "Seguimiento del Plan de Desarrollo Municipal";

  if (loading) {
    return <PdmLoadingOverlay message={isDetail ? "Cargando producto..." : "Cargando PDM..."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">Plan de Desarrollo Municipal</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tieneDatos && isDetail && (
            <button type="button" onClick={volverDesdeDetalle} className={pdmBtnSecondary}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
          )}
          {tieneDatos && route === "productos" && !isDetail && (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Año</label>
              <select
                value={filtroAnio}
                onChange={(e) => setFiltroAnio(Number(e.target.value))}
                className={pdmSelect}
              >
                {ANIOS_PDM.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}
          {tieneDatos && isAdmin && (
            <PdmAccionesMenu
              disabled={saving}
              onExportarPiip={() => void handleExportarPiip()}
              onContratos={() => setModalContratos(true)}
              onEjecucion={() => setModalEjecucion(true)}
              onRecargarPdm={triggerRecargarPdm}
            />
          )}
        </div>
      </div>

      {tieneDatos && !isDetail && (
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
      )}

      {error && <PdmAlert tone="error">{error}</PdmAlert>}

      {uploadFeedback && (
        <PdmAlert tone={uploadFeedback.tone}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{uploadFeedback.title}</p>
              <p className="mt-1">{uploadFeedback.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setUploadFeedback(null)}
              className="shrink-0 text-xs font-medium opacity-70 hover:opacity-100"
            >
              Cerrar
            </button>
          </div>
        </PdmAlert>
      )}

      {!tieneDatos && isAdmin && (
        <PdmCard className="mx-auto max-w-xl">
          <div className="flex flex-col items-center text-center">
            <CloudUpload className="mb-4 h-16 w-16 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">Cargar Plan de Desarrollo Municipal</h2>
            <p className="mt-2 text-sm text-slate-500">Archivo Excel con las 5 hojas del PDM</p>
            <ul className="mt-4 space-y-1 text-left text-sm text-slate-600">
              {[
                "Líneas Estratégicas",
                "Indicadores de Resultado",
                "Iniciativas SGR",
                "Plan Indicativo - Productos",
                "Plan Indicativo SGR - Productos",
              ].map((h) => (
                <li key={h} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  {h}
                </li>
              ))}
            </ul>
            <button type="button" className={`mt-6 inline-flex cursor-pointer ${pdmBtnPrimary} px-5 py-2.5`} onClick={triggerRecargarPdm}>
              <FileSpreadsheet size={18} /> Seleccionar archivo
            </button>
          </div>
        </PdmCard>
      )}

      {!tieneDatos && !isAdmin && (
        <PdmCard className="mx-auto max-w-xl text-center">
          <h2 className="text-lg font-semibold text-slate-900">Plan de Desarrollo Municipal</h2>
          <p className="mt-3 text-sm text-slate-600">
            El plan indicativo aún no ha sido cargado en la entidad. Solicite al administrador que suba el archivo Excel
            del PDM para habilitar el seguimiento.
          </p>
        </PdmCard>
      )}

      {tieneDatos && <Outlet />}

      <PdmSharedModals />
    </div>
  );
}

export default function PdmLayout() {
  return (
    <PdmProvider>
      <PdmLayoutInner />
    </PdmProvider>
  );
}
