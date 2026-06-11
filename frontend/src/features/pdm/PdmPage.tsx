import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Layers,
  Upload,
} from "lucide-react";
import { useAuthStore } from "@/core/auth/store";
import { bpinApi, type ProyectoBpin } from "@/core/api/bpin";
import { pdmApi, type PdmProducto } from "@/core/api/pdm";
import { secretariasApi } from "@/core/api/entities";
import { formatApiError } from "@/core/api/errors";
import {
  useInvalidatePdmQueries,
  pdmKeys,
  usePdmContratos,
  usePdmEjecucionProducto,
  usePdmMeta,
  usePdmProductoDetail,
  usePdmProductos,
  usePdmProyectos,
  usePdmResumenEjecucionAnual,
  usePdmStats,
  usePdmStatus,
} from "@/core/api/hooks/usePdm";
import PdmAccionesMenu from "@/features/pdm/PdmAccionesMenu";
import type { ActividadFormValues } from "@/features/pdm/PdmActividadModal";
import type { ContratosRPSResumen } from "@/features/pdm/PdmProductoDetalle";
import { pdmBtnPrimary, pdmBtnSecondary, pdmSelect } from "@/features/pdm/pdmLayout";
import { procesarArchivoExcelEnWorker } from "@/features/pdm/pdmExcelWorker";
import {
  ANIOS_PDM,
  getPresupuestoAnio,
  mapProductoToResumen,
  obtenerResumenActividadesPorAnio,
  statsFromApi,
  type ResumenProducto,
  type VistaPdm,
} from "@/features/pdm/pdmUtils";
import { PdmAlert, PdmCard, PdmFilePicker, PdmLoadingOverlay, PdmModal } from "@/features/pdm/components/PdmUi";
import type { PdmActividad } from "@/core/api/pdm";

const PdmDashboard = lazy(() => import("@/features/pdm/PdmDashboard"));
const PdmAnalisis = lazy(() => import("@/features/pdm/PdmAnalisis"));
const PdmProductosView = lazy(() => import("@/features/pdm/PdmProductosView"));
const PdmProyectosView = lazy(() => import("@/features/pdm/PdmProyectosView"));
const PdmProductoDetalle = lazy(() => import("@/features/pdm/PdmProductoDetalle"));
const PdmActividadModal = lazy(() => import("@/features/pdm/PdmActividadModal"));
const PdmBpinModal = lazy(() => import("@/features/pdm/PdmBpinModal"));

const PAGE_SIZE = 15;
const BUSQUEDA_DEBOUNCE_MS = 400;

type UploadFeedback = {
  tone: "success" | "error";
  title: string;
  detail: string;
};

function parseVista(raw: string | null): VistaPdm {
  if (raw === "productos" || raw === "detalle" || raw === "analisis" || raw === "proyectos") return raw;
  return "dashboard";
}

function VistaSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PdmLoadingOverlay message="Cargando vista..." />}>{children}</Suspense>;
}

export default function PdmPage(): ReactElement {
  const slug = useAuthStore((s) => s.user?.entity?.slug ?? "");
  const entityId = useAuthStore((s) => s.user?.entity?.id);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isSuperuser = useAuthStore((s) => s.user?.is_superuser ?? false);
  const secretariaUsuarioId = useAuthStore((s) => s.user?.secretaria?.id);
  const isAdmin = roles.includes("admin");
  const isSecretario = roles.includes("secretario");
  const puedeCrearEvidencia = Boolean(isAdmin || isSecretario || roles.includes("superadmin") || isSuperuser);
  const invalidatePdm = useInvalidatePdmQueries();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const vista = parseVista(searchParams.get("v"));
  const codigoUrl = searchParams.get("codigo") ?? "";

  const navegarVista = useCallback(
    (next: VistaPdm, opts?: { codigo?: string; from?: VistaPdm; replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "dashboard") {
            params.delete("v");
            params.delete("codigo");
            params.delete("from");
          } else {
            params.set("v", next);
            if (next === "detalle" && opts?.codigo) {
              params.set("codigo", opts.codigo);
              if (opts?.from) {
                params.set("from", opts.from);
              } else {
                params.delete("from");
              }
            } else {
              params.delete("codigo");
              params.delete("from");
            }
          }
          return params;
        },
        { replace: opts?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  const [procesandoExcel, setProcesandoExcel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback | null>(null);
  const [cargandoEvidenciaIds, setCargandoEvidenciaIds] = useState<Set<number>>(() => new Set());
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
  const [filtroAnioAnalisis, setFiltroAnioAnalisis] = useState<number | "all">(new Date().getFullYear());
  const [filtroSecretariaAnalisis, setFiltroSecretariaAnalisis] = useState("");
  const [anioDetalle, setAnioDetalle] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [filtroLinea, setFiltroLinea] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroSecretaria, setFiltroSecretaria] = useState("");
  const [filtroOds, setFiltroOds] = useState("");
  const [filtroTipoAcumulacion, setFiltroTipoAcumulacion] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroBusquedaDebounced, setFiltroBusquedaDebounced] = useState("");
  const [productoListPreview, setProductoListPreview] = useState<ResumenProducto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalContratos, setModalContratos] = useState(false);
  const [modalEjecucion, setModalEjecucion] = useState(false);
  const [anioContratos, setAnioContratos] = useState(2026);
  const [anioEjecucion, setAnioEjecucion] = useState(2026);
  const [archivoContratos, setArchivoContratos] = useState<File | null>(null);
  const [archivoEjecucion, setArchivoEjecucion] = useState<File | null>(null);
  const [mostrarModalActividad, setMostrarModalActividad] = useState(false);
  const [actividadEnEdicion, setActividadEnEdicion] = useState<PdmActividad | null>(null);
  const [guardandoEvidencia, setGuardandoEvidencia] = useState(false);
  const [mostrarModalBpin, setMostrarModalBpin] = useState(false);
  const [proyectoBpin, setProyectoBpin] = useState<ProyectoBpin | null>(null);
  const [cargandoBpin, setCargandoBpin] = useState(false);
  const [errorBpin, setErrorBpin] = useState<string | null>(null);
  const [consultaUrlBpin, setConsultaUrlBpin] = useState<string | null>(null);
  const [portalUrlBpin, setPortalUrlBpin] = useState<string | null>(null);

  const { data: status, isLoading: loadingStatus } = usePdmStatus(slug, Boolean(slug));
  const tieneDatos = Boolean(status?.tiene_datos);

  const { data: meta } = usePdmMeta(slug, tieneDatos && vista === "productos");
  const { data: statsData } = usePdmStats(slug, filtroAnio, tieneDatos && vista !== "detalle");
  const estadisticas = useMemo(() => (statsData ? statsFromApi(statsData) : null), [statsData]);
  const statsEstado = useMemo(
    () =>
      statsData?.estado_por_anio ?? {
        pendiente: 0,
        en_progreso: 0,
        completado: 0,
        por_ejecutar: 0,
        total: 0,
      },
    [statsData],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setFiltroBusquedaDebounced(filtroBusqueda), BUSQUEDA_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filtroBusqueda]);

  const listParams = useMemo(
    () => ({
      page: currentPage,
      page_size: PAGE_SIZE,
      anio: filtroAnio,
      ...(filtroLinea ? { linea_estrategica: filtroLinea } : {}),
      ...(filtroSector ? { sector_mga: filtroSector } : {}),
      ...(filtroSecretaria ? { responsable_secretaria: Number(filtroSecretaria) } : {}),
      ...(filtroOds ? { ods: filtroOds } : {}),
      ...(filtroTipoAcumulacion ? { tipo_acumulacion: filtroTipoAcumulacion } : {}),
      ...(filtroEstado ? { estado: filtroEstado } : {}),
      ...(filtroBusquedaDebounced.trim() ? { search: filtroBusquedaDebounced.trim() } : {}),
    }),
    [
      currentPage,
      filtroAnio,
      filtroLinea,
      filtroSector,
      filtroSecretaria,
      filtroOds,
      filtroTipoAcumulacion,
      filtroEstado,
      filtroBusquedaDebounced,
    ],
  );

  const { data: productosPage, isLoading: loadingProductos } = usePdmProductos(
    slug,
    listParams,
    tieneDatos && vista === "productos",
  );
  const { data: proyectosData, isLoading: loadingProyectos } = usePdmProyectos(
    slug,
    tieneDatos && vista === "proyectos",
  );
  const resumenProductos = useMemo(
    () => (productosPage?.results ?? []).map(mapProductoToResumen),
    [productosPage],
  );
  const totalCount = productosPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const needsSecretarias =
    Boolean(entityId) &&
    (isAdmin || mostrarModalActividad) &&
    (vista === "productos" || vista === "analisis" || mostrarModalActividad);
  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias", entityId],
    queryFn: () => secretariasApi.list(entityId!),
    enabled: needsSecretarias,
  });

  const { data: resumenEjecucion } = usePdmResumenEjecucionAnual(slug, tieneDatos && vista === "dashboard");

  const codigoDetalle = vista === "detalle" ? codigoUrl : "";
  const detalleEnabled = tieneDatos && vista === "detalle" && Boolean(codigoDetalle && slug);
  const { data: productoDetailData, isLoading: loadingProductoDetail } = usePdmProductoDetail(
    slug,
    codigoDetalle,
    anioDetalle,
    detalleEnabled,
  );
  const { data: ejecucionPresupuestal = null, isLoading: cargandoEjecucion } = usePdmEjecucionProducto(
    codigoDetalle,
    anioDetalle,
    detalleEnabled,
  );
  const { data: contratosRPS = null, isLoading: cargandoContratos } = usePdmContratos(
    slug,
    anioDetalle,
    codigoDetalle,
    detalleEnabled,
  );

  const productoSeleccionado = useMemo(() => {
    const base = productoDetailData ? mapProductoToResumen(productoDetailData) : productoListPreview;
    if (!base || cargandoEvidenciaIds.size === 0) return base;
    return {
      ...base,
      actividades: base.actividades.map((a) =>
        cargandoEvidenciaIds.has(a.id) ? { ...a, cargandoEvidencia: true } : a,
      ),
    };
  }, [productoDetailData, productoListPreview, cargandoEvidenciaIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    filtroAnio,
    filtroLinea,
    filtroSector,
    filtroSecretaria,
    filtroOds,
    filtroTipoAcumulacion,
    filtroEstado,
    filtroBusquedaDebounced,
  ]);

  useEffect(() => {
    if (vista !== "detalle") {
      setProductoListPreview(null);
      setMostrarModalActividad(false);
      setActividadEnEdicion(null);
    }
  }, [vista]);

  const limpiarFiltros = useCallback(() => {
    setFiltroLinea("");
    setFiltroSector("");
    setFiltroSecretaria("");
    setFiltroOds("");
    setFiltroTipoAcumulacion("");
    setFiltroEstado("");
    setFiltroBusqueda("");
    setFiltroBusquedaDebounced("");
  }, []);

  const volver = useCallback(() => {
    if (vista === "detalle") {
      if (searchParams.get("from") === "proyectos") {
        navegarVista("proyectos");
      } else {
        navegarVista("productos");
      }
    } else {
      navegarVista("dashboard");
    }
  }, [navegarVista, searchParams, vista]);

  const openDetalle = useCallback(
    (producto: ResumenProducto) => {
      setProductoListPreview(producto);
      setAnioDetalle(filtroAnio);
      navegarVista("detalle", { codigo: producto.codigo });
    },
    [filtroAnio, navegarVista],
  );

  const openProductoFromProyectos = useCallback(
    (codigo: string) => {
      setProductoListPreview(null);
      setAnioDetalle(new Date().getFullYear());
      navegarVista("detalle", { codigo, from: "proyectos" });
    },
    [navegarVista],
  );

  const seleccionarAnioDetalle = useCallback((anio: number) => {
    setAnioDetalle(anio);
  }, []);

  const resumenAnioDetalle = useMemo(() => {
    if (!productoSeleccionado) return null;
    return obtenerResumenActividadesPorAnio(productoSeleccionado, anioDetalle);
  }, [productoSeleccionado, anioDetalle]);

  const comparativaPresupuestal = useMemo(() => {
    if (!productoSeleccionado) return [];
    const pdm = getPresupuestoAnio(productoSeleccionado, anioDetalle);
    const ptoDefinitivo = Number(ejecucionPresupuestal?.totales?.pto_definitivo || 0);
    const pagos = Number(ejecucionPresupuestal?.totales?.pagos || 0);
    const pctPagado = ptoDefinitivo > 0 ? Math.round((pagos / ptoDefinitivo) * 1000) / 10 : 0;
    return [
      {
        anio: anioDetalle,
        pdm,
        ptoDefinitivo,
        pagos,
        pctPagado,
      },
    ];
  }, [productoSeleccionado, anioDetalle, ejecucionPresupuestal]);

  const guardarActividad = useCallback(
    async (values: ActividadFormValues) => {
      if (!slug || !productoSeleccionado) return;
      setGuardandoEvidencia(true);
      setSaving(true);
      setError(null);
      try {
        const payload = {
          codigo_producto: productoSeleccionado.codigo,
          anio: anioDetalle,
          nombre: values.nombre.trim(),
          descripcion: values.descripcion.trim(),
          responsable_secretaria: values.responsable_secretaria_id,
          estado: "COMPLETADA" as const,
          fecha_inicio: new Date(values.fecha_inicio).toISOString(),
          fecha_fin: new Date(values.fecha_fin).toISOString(),
          meta_ejecutar: values.meta_ejecutar,
        };
        const actividad = actividadEnEdicion
          ? await pdmApi.actualizarActividad(slug, actividadEnEdicion.id, payload)
          : await pdmApi.crearActividad(slug, payload);
        const evidenciaPayload = {
          descripcion: values.descripcion.trim(),
          url_evidencia: values.evidencia_url.trim() || undefined,
          archivos: values.imagenes_nuevas,
          archivos_eliminar: values.archivos_eliminar,
        };
        if (actividadEnEdicion?.evidencia?.id || actividadEnEdicion?.tiene_evidencia) {
          await pdmApi.actualizarEvidencia(slug, actividad.id, evidenciaPayload);
        } else {
          await pdmApi.registrarEvidencia(slug, actividad.id, evidenciaPayload);
        }
        invalidatePdm.afterActividadMutation(slug, productoSeleccionado.codigo, anioDetalle);
        setMostrarModalActividad(false);
        setActividadEnEdicion(null);
      } catch (e) {
        setError(formatApiError(e, "No se pudo guardar la actividad."));
      } finally {
        setGuardandoEvidencia(false);
        setSaving(false);
      }
    },
    [actividadEnEdicion, anioDetalle, invalidatePdm, productoSeleccionado, slug],
  );

  const handleExcelSelected = useCallback(
    async (file: File | null) => {
      if (!file || !slug) return;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "xlsx" && ext !== "xls") {
        setError("Seleccione un archivo Excel válido (.xlsx o .xls).");
        return;
      }
      setProcesandoExcel(true);
      setSaving(true);
      setError(null);
      try {
        const parsed = await procesarArchivoExcelEnWorker(file);
        if (parsed.productos_plan_indicativo.length === 0) {
          throw new Error("No se encontraron productos en la hoja 'Plan Indicativo - Productos'.");
        }
        const { buildPdmUploadPayload } = await import("@/features/pdm/pdmExcelParser");
        const payload = buildPdmUploadPayload(parsed);
        const result = await pdmApi.upload(slug, payload);
        invalidatePdm.afterUploadPlan(slug);
        setUploadFeedback({
          tone: "success",
          title: "Plan indicativo cargado",
          detail: `${parsed.productos_plan_indicativo.length} productos procesados. Total en entidad: ${result.total_productos ?? parsed.productos_plan_indicativo.length}.`,
        });
        setError(null);
        navegarVista("dashboard", { replace: true });
      } catch (e) {
        const detail = formatApiError(e, "No se pudo procesar el archivo.");
        setError(detail);
        setUploadFeedback({
          tone: "error",
          title: "Error al cargar plan indicativo",
          detail,
        });
      } finally {
        setProcesandoExcel(false);
        setSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [invalidatePdm, navegarVista, slug],
  );

  const handleAsignar = useCallback(
    async (p: ResumenProducto, sid: number) => {
      if (!slug || !sid) return;
      setSaving(true);
      try {
        await pdmApi.asignarResponsable(slug, p.codigo, sid);
        invalidatePdm.afterAsignarResponsable(slug);
      } catch (e) {
        setError(formatApiError(e, "No se pudo asignar."));
      } finally {
        setSaving(false);
      }
    },
    [invalidatePdm, slug],
  );

  const handleEliminarActividad = useCallback(
    async (a: PdmActividad) => {
      if (!slug || !productoSeleccionado || !window.confirm("¿Eliminar actividad?")) return;
      setSaving(true);
      try {
        await pdmApi.eliminarActividad(slug, a.id);
        invalidatePdm.afterActividadMutation(slug, productoSeleccionado.codigo, anioDetalle);
      } catch (e) {
        setError(formatApiError(e, "No se pudo eliminar."));
      } finally {
        setSaving(false);
      }
    },
    [anioDetalle, invalidatePdm, productoSeleccionado, slug],
  );

  const handleCargarEvidencia = useCallback(
    async (a: PdmActividad) => {
      if (!slug || !productoSeleccionado) return;
      setCargandoEvidenciaIds((prev) => new Set(prev).add(a.id));
      try {
        const ev = await pdmApi.getEvidencia(slug, a.id);
        const key = pdmKeys.producto(slug, productoSeleccionado.codigo, anioDetalle);
        queryClient.setQueryData<PdmProducto | undefined>(key, (old) => {
          if (!old?.actividades) return old;
          return {
            ...old,
            actividades: old.actividades.map((act) =>
              act.id === a.id ? { ...act, evidencia: ev, tiene_evidencia: true } : act,
            ),
          };
        });
      } catch (e) {
        const detail = formatApiError(e, "No se pudo cargar la evidencia.");
        setUploadFeedback({
          tone: "error",
          title: "Error al cargar evidencia",
          detail,
        });
      } finally {
        setCargandoEvidenciaIds((prev) => {
          const next = new Set(prev);
          next.delete(a.id);
          return next;
        });
      }
    },
    [anioDetalle, productoSeleccionado, queryClient, slug],
  );

  const handleEditarActividad = useCallback(
    (a: PdmActividad) => {
      void (async () => {
        let act = a;
        if (a.tiene_evidencia && !a.evidencia && slug) {
          try {
            act = { ...a, evidencia: await pdmApi.getEvidencia(slug, a.id) };
          } catch {
            /* ignore */
          }
        }
        setActividadEnEdicion(act);
        setMostrarModalActividad(true);
      })();
    },
    [slug],
  );

  const handleExportarPiip = useCallback(async () => {
    if (!slug) return;
    setSaving(true);
    setError(null);
    try {
      await pdmApi.exportPiip(slug, filtroAnio);
      setUploadFeedback({
        tone: "success",
        title: "Exportación PIIP",
        detail: `Se descargó el archivo PIIP_${slug}_${filtroAnio}.xlsx.`,
      });
    } catch (e) {
      const detail = formatApiError(e, "No se pudo exportar PIIP.");
      setError(detail);
      setUploadFeedback({
        tone: "error",
        title: "Error al exportar PIIP",
        detail,
      });
    } finally {
      setSaving(false);
    }
  }, [filtroAnio, slug]);

  const handleAbrirBpin = useCallback((bpin: string) => {
    setMostrarModalBpin(true);
    setCargandoBpin(true);
    setProyectoBpin(null);
    setErrorBpin(null);
    setConsultaUrlBpin(null);
    setPortalUrlBpin(null);
    void bpinApi
      .get(bpin)
      .then((r) => {
        setProyectoBpin(r.proyecto);
        setConsultaUrlBpin(r.consulta_url);
        setPortalUrlBpin(r.portal_url);
        setErrorBpin(r.proyecto ? null : r.detail || "No se encontró información para este código BPIN.");
      })
      .catch((e) => {
        setProyectoBpin(null);
        setErrorBpin(formatApiError(e, "Error al consultar datos.gov.co."));
      })
      .finally(() => setCargandoBpin(false));
  }, []);

  const loading = loadingStatus || procesandoExcel;
  const cargandoDetalleUrl = detalleEnabled && (loadingProductoDetail || !productoSeleccionado);

  if (loading || cargandoDetalleUrl) {
    return (
      <PdmLoadingOverlay
        message={procesandoExcel ? "Procesando Excel..." : cargandoDetalleUrl ? "Cargando producto..." : "Cargando PDM..."}
      />
    );
  }

  const pageTitle = !tieneDatos
    ? "Plan de Desarrollo Municipal"
    : vista === "dashboard"
      ? "Seguimiento PDM"
      : vista === "analisis"
        ? "Análisis PDM"
        : vista === "proyectos"
          ? "Proyectos BPIN"
        : vista === "productos"
          ? "Productos"
          : "Detalle del producto";

  const headerSubtitle = !tieneDatos
    ? isAdmin
      ? "Cargue el Excel del plan indicativo (5 hojas)"
      : "El administrador debe cargar el plan indicativo de la entidad"
    : isSecretario && !isAdmin
      ? "Productos asignados a su secretaría"
      : vista === "dashboard"
        ? "Seguimiento del Plan de Desarrollo Municipal"
        : vista === "analisis"
          ? "Dashboard analítico del Plan de Desarrollo Municipal"
          : vista === "proyectos"
            ? "Proyectos de inversión unificados por BPIN y sus productos del Plan Indicativo"
          : vista === "productos"
            ? "Consulta y filtrado de productos por año"
            : "Detalle, actividades y ejecución del producto";

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => void handleExcelSelected(e.target.files?.[0] || null)}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">{pageTitle}</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{headerSubtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tieneDatos && vista !== "dashboard" && (
            <button type="button" onClick={volver} className={pdmBtnSecondary}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
          )}
          {tieneDatos && (vista === "dashboard" || vista === "analisis") && (
            <button type="button" onClick={() => navegarVista("productos")} className={pdmBtnPrimary}>
              <FileSpreadsheet className="h-4 w-4" /> Ver productos
            </button>
          )}
          {tieneDatos && vista === "dashboard" && (
            <button type="button" onClick={() => navegarVista("analisis")} className={pdmBtnSecondary}>
              <BarChart3 className="h-4 w-4" /> Análisis
            </button>
          )}
          {tieneDatos && isAdmin && (
            <PdmAccionesMenu
              disabled={saving}
              onProyectos={() => navegarVista("proyectos")}
              onExportarPiip={() => void handleExportarPiip()}
              onContratos={() => setModalContratos(true)}
              onEjecucion={() => setModalEjecucion(true)}
              onRecargarPdm={() => fileInputRef.current?.click()}
            />
          )}
        </div>
      </div>

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
            <button
              type="button"
              className={`mt-6 inline-flex cursor-pointer ${pdmBtnPrimary} px-5 py-2.5`}
              onClick={() => fileInputRef.current?.click()}
            >
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

      {tieneDatos && vista === "dashboard" && estadisticas && (
        <VistaSuspense>
          <PdmDashboard
            estadisticas={estadisticas}
            resumenEjecucion={resumenEjecucion ?? null}
            onVerProductos={() => navegarVista("productos")}
          />
        </VistaSuspense>
      )}

      {tieneDatos && vista === "analisis" && (
        <VistaSuspense>
          <PdmAnalisis
            slug={slug}
            filtroAnio={filtroAnioAnalisis}
            onFiltroAnio={setFiltroAnioAnalisis}
            filtroSecretaria={filtroSecretariaAnalisis}
            onFiltroSecretaria={setFiltroSecretariaAnalisis}
            secretarias={secretarias}
            isAdmin={isAdmin}
          />
        </VistaSuspense>
      )}

      {tieneDatos && vista === "proyectos" && (
        <VistaSuspense>
          <PdmProyectosView
            data={proyectosData}
            isLoading={loadingProyectos}
            onOpenProducto={openProductoFromProyectos}
          />
        </VistaSuspense>
      )}

      {tieneDatos && vista === "productos" && (
        <VistaSuspense>
          <PdmProductosView
            filtroAnio={filtroAnio}
            onFiltroAnio={setFiltroAnio}
            meta={meta}
            secretarias={secretarias}
            isAdmin={isAdmin}
            saving={saving}
            productos={resumenProductos}
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            isLoading={loadingProductos}
            statsEstado={statsEstado}
            filtroLinea={filtroLinea}
            filtroSector={filtroSector}
            filtroSecretaria={filtroSecretaria}
            filtroOds={filtroOds}
            filtroTipoAcumulacion={filtroTipoAcumulacion}
            filtroEstado={filtroEstado}
            filtroBusqueda={filtroBusqueda}
            onFiltroLinea={setFiltroLinea}
            onFiltroSector={setFiltroSector}
            onFiltroSecretaria={setFiltroSecretaria}
            onFiltroOds={setFiltroOds}
            onFiltroTipoAcumulacion={setFiltroTipoAcumulacion}
            onFiltroEstado={setFiltroEstado}
            onFiltroBusqueda={setFiltroBusqueda}
            onLimpiarFiltros={limpiarFiltros}
            onPageChange={setCurrentPage}
            onOpenDetalle={openDetalle}
            onAsignar={handleAsignar}
          />
        </VistaSuspense>
      )}

      {tieneDatos && vista === "detalle" && productoSeleccionado && resumenAnioDetalle && (
        <VistaSuspense>
          <PdmProductoDetalle
            producto={productoSeleccionado}
            anioDetalle={anioDetalle}
            onAnioDetalle={seleccionarAnioDetalle}
            resumenAnioDetalle={resumenAnioDetalle}
            comparativaPresupuestal={comparativaPresupuestal}
            ejecucionPresupuestal={ejecucionPresupuestal}
            cargandoEjecucion={cargandoEjecucion}
            contratosRPS={contratosRPS as ContratosRPSResumen | null}
            cargandoContratos={cargandoContratos}
            cargandoActividadesBackend={loadingProductoDetail}
            saving={saving}
            puedeCrearEvidencia={puedeCrearEvidencia}
            isAdmin={isAdmin}
            onNuevaActividad={() => {
              setActividadEnEdicion(null);
              setMostrarModalActividad(true);
            }}
            onEditarActividad={handleEditarActividad}
            onEliminarActividad={handleEliminarActividad}
            onCargarEvidencia={handleCargarEvidencia}
            unidad={productoSeleccionado.unidad_medida || "N/D"}
            onAbrirBpin={handleAbrirBpin}
          />
        </VistaSuspense>
      )}

      <PdmModal
        open={modalEjecucion}
        title="Cargar ejecución presupuestal"
        headerTone="success"
        onClose={() => setModalEjecucion(false)}
        footer={
          <>
            <button type="button" onClick={() => setModalEjecucion(false)} className={pdmBtnSecondary}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!archivoEjecucion || saving}
              className={pdmBtnPrimary}
              onClick={() =>
                void (async () => {
                  if (!archivoEjecucion) return;
                  setSaving(true);
                  try {
                    const result = await pdmApi.uploadEjecucion(archivoEjecucion, anioEjecucion);
                    invalidatePdm.afterUploadEjecucion(slug);
                    setModalEjecucion(false);
                    setArchivoEjecucion(null);
                    setError(null);
                    setUploadFeedback({
                      tone: "success",
                      title: "Ejecución presupuestal cargada",
                      detail:
                        result.message ||
                        `${result.registros_insertados ?? 0} registros insertados, ${result.registros_eliminados ?? 0} eliminados del año ${anioEjecucion}.`,
                    });
                  } catch (e) {
                    const detail = formatApiError(e, "Error al cargar.");
                    setError(detail);
                    setUploadFeedback({
                      tone: "error",
                      title: "Error al cargar ejecución presupuestal",
                      detail,
                    });
                  } finally {
                    setSaving(false);
                  }
                })()
              }
            >
              <Upload className="h-4 w-4" /> Cargar
            </button>
          </>
        }
      >
        <PdmAlert tone="info">Reemplaza todos los datos de ejecución del año seleccionado.</PdmAlert>
        <label className="mt-4 block text-sm font-medium text-slate-700">Año</label>
        <select className={`mt-1 ${pdmSelect}`} value={anioEjecucion} onChange={(e) => setAnioEjecucion(Number(e.target.value))}>
          {ANIOS_PDM.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <PdmFilePicker
          accept=".xlsx,.xls,.csv"
          file={archivoEjecucion}
          onChange={setArchivoEjecucion}
          emptyLabel="Seleccionar Excel de ejecución"
        />
      </PdmModal>

      <PdmModal
        open={modalContratos}
        title="Cargar contratos RPS"
        headerTone="primary"
        onClose={() => setModalContratos(false)}
        footer={
          <>
            <button type="button" onClick={() => setModalContratos(false)} className={pdmBtnSecondary}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!archivoContratos || saving || !slug}
              className={pdmBtnPrimary}
              onClick={() =>
                void (async () => {
                  if (!archivoContratos || !slug) return;
                  setSaving(true);
                  try {
                    const result = await pdmApi.uploadContratos(slug, archivoContratos, anioContratos);
                    setModalContratos(false);
                    setArchivoContratos(null);
                    if (productoSeleccionado && vista === "detalle") {
                      invalidatePdm.invalidateContratos(slug, anioContratos, productoSeleccionado.codigo);
                    }
                    setError(null);
                    setUploadFeedback({
                      tone: "success",
                      title: "Contratos RPS cargados",
                      detail:
                        result.mensaje ||
                        `${result.registros_insertados ?? 0} nuevos, ${result.registros_actualizados ?? 0} actualizados (año ${anioContratos}).`,
                    });
                  } catch (e) {
                    const detail = formatApiError(e, "Error al cargar.");
                    setError(detail);
                    setUploadFeedback({
                      tone: "error",
                      title: "Error al cargar contratos RPS",
                      detail,
                    });
                  } finally {
                    setSaving(false);
                  }
                })()
              }
            >
              <Upload className="h-4 w-4" /> Cargar
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-slate-700">Año</label>
        <select className={`mt-1 ${pdmSelect}`} value={anioContratos} onChange={(e) => setAnioContratos(Number(e.target.value))}>
          {ANIOS_PDM.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="mt-3">
          <PdmAlert tone="info">
            Actualiza contratos existentes y agrega nuevos según producto y No. CRP (no elimina los que no vengan en el
            archivo).
          </PdmAlert>
        </div>
        <PdmFilePicker
          accept=".xlsx,.xls,.csv"
          file={archivoContratos}
          onChange={setArchivoContratos}
          emptyLabel="Seleccionar Excel de contratos RPS"
          hint={
            <>
              Columnas: <strong>PRODUCTO</strong>, <strong>NO CRP</strong> (o CRP / NO CRP/CRP), <strong>VALOR</strong>.
              Opcionales: CONCEPTO, CONTRATISTA.
            </>
          }
        />
      </PdmModal>

      {vista === "detalle" && productoSeleccionado && mostrarModalActividad && (
        <VistaSuspense>
          <PdmActividadModal
            open={mostrarModalActividad}
            anio={anioDetalle}
            producto={productoSeleccionado}
            secretarias={secretarias}
            actividadEnEdicion={actividadEnEdicion}
            secretariaUsuarioId={secretariaUsuarioId}
            esSecretario={isSecretario}
            saving={guardandoEvidencia || saving}
            onClose={() => {
              setMostrarModalActividad(false);
              setActividadEnEdicion(null);
            }}
            onSave={guardarActividad}
          />
        </VistaSuspense>
      )}

      <VistaSuspense>
        <PdmBpinModal
          open={mostrarModalBpin}
          cargando={cargandoBpin}
          proyecto={proyectoBpin}
          error={errorBpin}
          consultaUrl={consultaUrlBpin}
          portalUrl={portalUrlBpin}
          onClose={() => {
            setMostrarModalBpin(false);
            setProyectoBpin(null);
            setErrorBpin(null);
            setConsultaUrlBpin(null);
            setPortalUrlBpin(null);
          }}
        />
      </VistaSuspense>
    </div>
  );
}
