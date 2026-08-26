import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { bpinApi, type ProyectoBpin } from "@/core/api/bpin";
import { pdmApi, type PdmActividad, type PdmEjecucionProducto, type PdmProducto } from "@/core/api/pdm";
import { secretariasApi } from "@/core/api/entities";
import { usersApi, type AppUser } from "@/core/api/users";
import { formatApiError } from "@/core/api/errors";
import { useAuthStore } from "@/core/auth/store";
import type { ActividadFormValues } from "@/features/pdm/PdmActividadModal";
import type { ContratosRPSResumen } from "@/features/pdm/PdmProductoDetalle";
import { procesarArchivoExcelEnWorker } from "@/features/pdm/pdmExcelWorker";
import {
  getPresupuestoAnio,
  mapProductoToResumen,
  obtenerResumenActividadesPorAnio,
  statsFromApi,
  type ResumenProducto,
} from "@/features/pdm/pdmUtils";
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
import { readDetalleFrom, usePdmRoute, type PdmDetalleFrom } from "@/features/pdm/pdmRoutes";

const PAGE_SIZE = 15;
const BUSQUEDA_DEBOUNCE_MS = 400;

type UploadFeedback = {
  tone: "success" | "error";
  title: string;
  detail: string;
};

interface PdmContextValue {
  slug: string;
  entityId: number | undefined;
  enablePdm: boolean;
  isAdmin: boolean;
  isSecretario: boolean;
  canDelegateContratista: boolean;
  puedeCrearEvidencia: boolean;
  secretariaUsuarioId: number | undefined;
  route: ReturnType<typeof usePdmRoute>;
  tieneDatos: boolean;
  loading: boolean;
  saving: boolean;
  setSaving: (v: boolean) => void;
  error: string | null;
  setError: (msg: string | null) => void;
  uploadFeedback: UploadFeedback | null;
  setUploadFeedback: (fb: UploadFeedback | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  filtroAnio: number;
  setFiltroAnio: (y: number) => void;
  filtroAnioAnalisis: number | "all";
  setFiltroAnioAnalisis: (y: number | "all") => void;
  filtroSecretariaAnalisis: string;
  setFiltroSecretariaAnalisis: (v: string) => void;
  anioDetalle: number;
  setAnioDetalle: (y: number) => void;
  estadisticas: ReturnType<typeof statsFromApi> | null;
  resumenEjecucion: import("@/features/pdm/pdmUtils").ResumenEjecucionAnual | null;
  meta: ReturnType<typeof usePdmMeta>["data"];
  statsEstado: NonNullable<ReturnType<typeof usePdmStats>["data"]>["estado_por_anio"];
  statsData: ReturnType<typeof usePdmStats>["data"];
  resumenProductos: ResumenProducto[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  loadingProductos: boolean;
  proyectosData: ReturnType<typeof usePdmProyectos>["data"];
  loadingProyectos: boolean;
  secretarias: Awaited<ReturnType<typeof secretariasApi.list>>;
  contratistas: AppUser[];
  productoSeleccionado: ResumenProducto | null;
  resumenAnioDetalle: ReturnType<typeof obtenerResumenActividadesPorAnio> | null;
  comparativaPresupuestal: {
    anio: number;
    pdm: number;
    ptoDefinitivo: number;
    pagos: number;
    pctPagado: number;
  }[];
  ejecucionPresupuestal: PdmEjecucionProducto | null;
  cargandoEjecucion: boolean;
  contratosRPS: ContratosRPSResumen | null;
  cargandoContratos: boolean;
  loadingProductoDetail: boolean;
  filtroLinea: string;
  filtroSector: string;
  filtroSecretaria: string;
  filtroOds: string;
  filtroTipoAcumulacion: string;
  filtroEstado: string;
  filtroBusqueda: string;
  setFiltroLinea: (v: string) => void;
  setFiltroSector: (v: string) => void;
  setFiltroSecretaria: (v: string) => void;
  setFiltroOds: (v: string) => void;
  setFiltroTipoAcumulacion: (v: string) => void;
  setFiltroEstado: (v: string) => void;
  setFiltroBusqueda: (v: string) => void;
  limpiarFiltros: () => void;
  setCurrentPage: (p: number) => void;
  openDetalle: (producto: ResumenProducto, from?: PdmDetalleFrom) => void;
  openDetalleByCodigo: (codigo: string, from?: PdmDetalleFrom) => void;
  openProductoFromProyectos: (codigo: string) => void;
  volverDesdeDetalle: () => void;
  handleExcelSelected: (file: File | null) => Promise<void>;
  handleAsignar: (p: ResumenProducto, sid: number) => Promise<void>;
  handleAsignarUsuario: (p: ResumenProducto, uid: number | null) => Promise<void>;
  handleEliminarActividad: (a: PdmActividad) => Promise<void>;
  handleCargarEvidencia: (a: PdmActividad) => Promise<void>;
  handleEditarActividad: (a: PdmActividad) => void;
  handleExportarPiip: () => Promise<void>;
  handleAbrirBpin: (bpin: string) => void;
  guardarActividad: (values: ActividadFormValues) => Promise<void>;
  modalContratos: boolean;
  setModalContratos: (v: boolean) => void;
  modalEjecucion: boolean;
  setModalEjecucion: (v: boolean) => void;
  anioContratos: number;
  setAnioContratos: (y: number) => void;
  anioEjecucion: number;
  setAnioEjecucion: (y: number) => void;
  archivoContratos: File | null;
  setArchivoContratos: (f: File | null) => void;
  archivoEjecucion: File | null;
  setArchivoEjecucion: (f: File | null) => void;
  mostrarModalActividad: boolean;
  setMostrarModalActividad: (v: boolean) => void;
  actividadEnEdicion: PdmActividad | null;
  setActividadEnEdicion: (a: PdmActividad | null) => void;
  guardandoEvidencia: boolean;
  mostrarModalBpin: boolean;
  setMostrarModalBpin: (v: boolean) => void;
  proyectoBpin: ProyectoBpin | null;
  cargandoBpin: boolean;
  errorBpin: string | null;
  consultaUrlBpin: string | null;
  portalUrlBpin: string | null;
  cerrarModalBpin: () => void;
    triggerRecargarPdm: () => void;
}

const PdmContext = createContext<PdmContextValue | null>(null);

export function PdmProvider({ children }: { children: ReactNode }) {
  const entity = useAuthStore((s) => s.user?.entity);
  const slug = entity?.slug ?? "";
  const entityId = entity?.id;
  const enablePdm = Boolean(entity?.enable_pdm);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const isSuperuser = useAuthStore((s) => s.user?.is_superuser ?? false);
  const secretariaUsuarioId = useAuthStore((s) => s.user?.secretaria?.id);
  const isAdmin = roles.includes("admin");
  const isSecretario = roles.includes("secretario");
  const canDelegateContratista = isSecretario;
  const puedeCrearEvidencia = Boolean(isAdmin || isSecretario || roles.includes("superadmin") || isSuperuser);

  const route = usePdmRoute();
  const navigate = useNavigate();
  const location = useLocation();
  const { codigo: codigoParam } = useParams<{ codigo?: string }>();
  const codigoDetalle = route === "detalle" ? decodeURIComponent(codigoParam ?? "") : "";

  const invalidatePdm = useInvalidatePdmQueries();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: meta } = usePdmMeta(slug, tieneDatos && route === "productos");
  const { data: statsData } = usePdmStats(slug, filtroAnio, tieneDatos && route !== "detalle");
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
    tieneDatos && route === "productos",
  );
  const { data: proyectosData, isLoading: loadingProyectos } = usePdmProyectos(
    slug,
    tieneDatos && route === "proyectos",
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
    (route === "productos" || route === "analisis" || mostrarModalActividad);
  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias", entityId],
    queryFn: () => secretariasApi.list(entityId!),
    enabled: needsSecretarias,
  });

  const { data: contratistas = [] } = useQuery({
    queryKey: ["contratistas", entityId],
    queryFn: () => usersApi.list({ role: "contratista", page_size: 100 }),
    enabled: Boolean(entityId) && canDelegateContratista && (route === "productos" || mostrarModalActividad),
  });

  const { data: resumenEjecucion } = usePdmResumenEjecucionAnual(slug, tieneDatos && route === "dashboard");

  const detalleEnabled = tieneDatos && route === "detalle" && Boolean(codigoDetalle && slug);
  const { data: productoDetailData, isLoading: loadingProductoDetail } = usePdmProductoDetail(
    slug,
    codigoDetalle,
    anioDetalle,
    detalleEnabled,
  );
  const codigoEjecucionDetalle =
    productoDetailData?.codigo_producto ?? productoListPreview?.codigo ?? "";
  const { data: ejecucionPresupuestal = null, isLoading: cargandoEjecucion } = usePdmEjecucionProducto(
    codigoEjecucionDetalle,
    anioDetalle,
    detalleEnabled && Boolean(codigoEjecucionDetalle),
  );
  const { data: contratosRPS = null, isLoading: cargandoContratos } = usePdmContratos(
    slug,
    anioDetalle,
    codigoEjecucionDetalle,
    detalleEnabled && Boolean(codigoEjecucionDetalle),
  );

  const productoSeleccionado = useMemo(() => {
    let base = productoDetailData ? mapProductoToResumen(productoDetailData) : productoListPreview;
    if (!base) return null;
    if (ejecucionPresupuestal?.totales) {
      const pto = Number(ejecucionPresupuestal.totales.pto_definitivo || 0);
      const pagos = Number(ejecucionPresupuestal.totales.pagos || 0);
      base = {
        ...base,
        pto_definitivo_anio: pto,
        pagos_anio: pagos,
        avance_financiero_anio: pto > 0 ? Math.round((pagos / pto) * 1000) / 10 : 0,
      };
    }
    if (cargandoEvidenciaIds.size === 0) return base;
    return {
      ...base,
      actividades: base.actividades.map((a) =>
        cargandoEvidenciaIds.has(a.id) ? { ...a, cargandoEvidencia: true } : a,
      ),
    };
  }, [productoDetailData, productoListPreview, cargandoEvidenciaIds, ejecucionPresupuestal]);

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
    if (route !== "detalle") {
      setProductoListPreview(null);
      setMostrarModalActividad(false);
      setActividadEnEdicion(null);
    }
  }, [route]);

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

  const volverDesdeDetalle = useCallback(() => {
    const from = readDetalleFrom(location.state);
    if (from === "proyectos") navigate("/pdm/proyectos");
    else navigate("/pdm/productos");
  }, [location.state, navigate]);

  const openDetalle = useCallback(
    (producto: ResumenProducto, from?: PdmDetalleFrom) => {
      setProductoListPreview(producto);
      setAnioDetalle(filtroAnio);
      navigate(`/pdm/productos/${encodeURIComponent(producto.clave)}`, {
        state: from ? { from } : undefined,
      });
    },
    [filtroAnio, navigate],
  );

  const openDetalleByCodigo = useCallback(
    (codigo: string, from?: PdmDetalleFrom) => {
      setProductoListPreview(null);
      setAnioDetalle(from === "analisis" ? (typeof filtroAnioAnalisis === "number" ? filtroAnioAnalisis : new Date().getFullYear()) : new Date().getFullYear());
      navigate(`/pdm/productos/${encodeURIComponent(codigo)}`, {
        state: from ? { from } : undefined,
      });
    },
    [filtroAnioAnalisis, navigate],
  );

  const openProductoFromProyectos = useCallback(
    (codigo: string) => {
      openDetalleByCodigo(codigo, "proyectos");
    },
    [openDetalleByCodigo],
  );

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
    return [{ anio: anioDetalle, pdm, ptoDefinitivo, pagos, pctPagado }];
  }, [productoSeleccionado, anioDetalle, ejecucionPresupuestal]);

  const guardarActividad = useCallback(
    async (values: ActividadFormValues) => {
      if (!slug || !productoSeleccionado) return;
      setGuardandoEvidencia(true);
      setSaving(true);
      setError(null);
      try {
        const payload = {
          clave_producto: productoSeleccionado.clave,
          anio: anioDetalle,
          nombre: values.nombre.trim(),
          descripcion: values.descripcion.trim(),
          responsable_secretaria: values.responsable_secretaria_id,
          responsable_usuario: values.responsable_usuario_id,
          estado: "COMPLETADA" as const,
          fecha_inicio: new Date(values.fecha_inicio).toISOString(),
          fecha_fin: new Date(values.fecha_fin).toISOString(),
          meta_ejecutar: values.meta_ejecutar,
        };
        const actividad = actividadEnEdicion
          ? await pdmApi.actualizarActividad(slug, actividadEnEdicion.id, payload)
          : await pdmApi.crearActividad(slug, payload);
        const evidenciaPayload = {
          url_evidencia: values.evidencia_url.trim() || undefined,
          archivos: values.imagenes_nuevas,
          archivos_eliminar: values.archivos_eliminar,
        };
        if (actividadEnEdicion?.evidencia?.id || actividadEnEdicion?.tiene_evidencia) {
          await pdmApi.actualizarEvidencia(slug, actividad.id, evidenciaPayload);
        } else {
          await pdmApi.registrarEvidencia(slug, actividad.id, evidenciaPayload);
        }
        invalidatePdm.afterActividadMutation(slug, productoSeleccionado.clave, anioDetalle);
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
          detail: `${result.filas_recibidas ?? parsed.productos_plan_indicativo.length} filas recibidas · ${result.claves_procesadas ?? parsed.productos_plan_indicativo.length} claves · Total en entidad: ${result.total_productos ?? 0}.`,
        });
        setError(null);
        navigate("/pdm", { replace: true });
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
    [invalidatePdm, navigate, slug],
  );

  const handleAsignar = useCallback(
    async (p: ResumenProducto, sid: number) => {
      if (!slug || !sid) return;
      setSaving(true);
      try {
        await pdmApi.asignarResponsable(slug, p.clave, sid);
        invalidatePdm.afterAsignarResponsable(slug);
      } catch (e) {
        setError(formatApiError(e, "No se pudo asignar."));
      } finally {
        setSaving(false);
      }
    },
    [invalidatePdm, slug],
  );

  const handleAsignarUsuario = useCallback(
    async (p: ResumenProducto, uid: number | null) => {
      if (!slug) return;
      setSaving(true);
      try {
        await pdmApi.asignarResponsableUsuario(slug, p.clave, uid);
        invalidatePdm.afterAsignarResponsable(slug);
      } catch (e) {
        setError(formatApiError(e, "No se pudo asignar al contratista."));
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
        invalidatePdm.afterActividadMutation(slug, productoSeleccionado.clave, anioDetalle);
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
        const key = pdmKeys.producto(slug, productoSeleccionado.clave, anioDetalle);
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
      const anioExport = route === "productos" ? filtroAnio : new Date().getFullYear();
      await pdmApi.exportPiip(slug, anioExport);
      setUploadFeedback({
        tone: "success",
        title: "Exportación PIIP",
        detail: `Se descargó el archivo PIIP_${slug}_${anioExport}.xlsx.`,
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
  }, [filtroAnio, route, slug]);

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

  const cerrarModalBpin = useCallback(() => {
    setMostrarModalBpin(false);
    setProyectoBpin(null);
    setErrorBpin(null);
    setConsultaUrlBpin(null);
    setPortalUrlBpin(null);
  }, []);

  const triggerRecargarPdm = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const loading = loadingStatus || procesandoExcel;
  const cargandoDetalleUrl = detalleEnabled && (loadingProductoDetail || !productoSeleccionado);

  const value: PdmContextValue = {
    slug,
    entityId,
    enablePdm,
    isAdmin,
    isSecretario,
    canDelegateContratista,
    puedeCrearEvidencia,
    secretariaUsuarioId,
    route,
    tieneDatos,
    loading: loading || cargandoDetalleUrl,
    saving,
    setSaving,
    error,
    setError,
    uploadFeedback,
    setUploadFeedback,
    fileInputRef,
    filtroAnio,
    setFiltroAnio,
    filtroAnioAnalisis,
    setFiltroAnioAnalisis,
    filtroSecretariaAnalisis,
    setFiltroSecretariaAnalisis,
    anioDetalle,
    setAnioDetalle,
    estadisticas,
    resumenEjecucion: resumenEjecucion ?? null,
    meta,
    statsEstado,
    statsData,
    resumenProductos,
    totalCount,
    currentPage,
    totalPages,
    loadingProductos,
    proyectosData,
    loadingProyectos,
    secretarias,
    contratistas,
    productoSeleccionado,
    resumenAnioDetalle,
    comparativaPresupuestal,
    ejecucionPresupuestal: ejecucionPresupuestal ?? null,
    cargandoEjecucion,
    contratosRPS: contratosRPS as ContratosRPSResumen | null,
    cargandoContratos,
    loadingProductoDetail,
    filtroLinea,
    filtroSector,
    filtroSecretaria,
    filtroOds,
    filtroTipoAcumulacion,
    filtroEstado,
    filtroBusqueda,
    setFiltroLinea,
    setFiltroSector,
    setFiltroSecretaria,
    setFiltroOds,
    setFiltroTipoAcumulacion,
    setFiltroEstado,
    setFiltroBusqueda,
    limpiarFiltros,
    setCurrentPage,
    openDetalle,
    openDetalleByCodigo,
    openProductoFromProyectos,
    volverDesdeDetalle,
    handleExcelSelected,
    handleAsignar,
    handleAsignarUsuario,
    handleEliminarActividad,
    handleCargarEvidencia,
    handleEditarActividad,
    handleExportarPiip,
    handleAbrirBpin,
    guardarActividad,
    modalContratos,
    setModalContratos,
    modalEjecucion,
    setModalEjecucion,
    anioContratos,
    setAnioContratos,
    anioEjecucion,
    setAnioEjecucion,
    archivoContratos,
    setArchivoContratos,
    archivoEjecucion,
    setArchivoEjecucion,
    mostrarModalActividad,
    setMostrarModalActividad,
    actividadEnEdicion,
    setActividadEnEdicion,
    guardandoEvidencia,
    mostrarModalBpin,
    setMostrarModalBpin,
    proyectoBpin,
    cargandoBpin,
    errorBpin,
    consultaUrlBpin,
    portalUrlBpin,
    cerrarModalBpin,
    triggerRecargarPdm,
  };

  return <PdmContext.Provider value={value}>{children}</PdmContext.Provider>;
}

export function usePdm() {
  const ctx = useContext(PdmContext);
  if (!ctx) throw new Error("usePdm debe usarse dentro de PdmProvider");
  return ctx;
}
