import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  Layers,
  Upload,
} from "lucide-react";
import { useAuthStore } from "@/core/auth/store";
import { bpinApi, type ProyectoBpin } from "@/core/api/bpin";
import { pdmApi } from "@/core/api/pdm";
import { secretariasApi } from "@/core/api/entities";
import { formatApiError } from "@/core/api/errors";
import {
  useInvalidatePdm,
  usePdmMeta,
  usePdmProductos,
  usePdmStats,
  usePdmStatus,
} from "@/core/api/hooks/usePdm";
import PdmAccionesMenu from "@/features/pdm/PdmAccionesMenu";
import PdmActividadModal, { type ActividadFormValues } from "@/features/pdm/PdmActividadModal";
import PdmBpinModal from "@/features/pdm/PdmBpinModal";
import PdmDashboard from "@/features/pdm/PdmDashboard";
import PdmProductoDetalle, { type ContratosRPSResumen } from "@/features/pdm/PdmProductoDetalle";
import PdmProductosView from "@/features/pdm/PdmProductosView";
import { pdmBtnPrimary, pdmBtnSecondary, pdmSelect } from "@/features/pdm/pdmLayout";
import { buildPdmUploadPayload, procesarArchivoExcel } from "@/features/pdm/pdmExcelParser";
import {
  ANIOS_PDM,
  getPresupuestoAnio,
  mapProductoToResumen,
  obtenerResumenActividadesPorAnio,
  statsFromApi,
  type ResumenEjecucionAnual,
  type ResumenProducto,
  type VistaPdm,
} from "@/features/pdm/pdmUtils";
import { PdmAlert, PdmCard, PdmLoadingOverlay, PdmModal } from "@/features/pdm/components/PdmUi";
import type { PdmActividad, PdmEjecucionProducto } from "@/core/api/pdm";

const PAGE_SIZE = 15;

export default function PdmPage(): ReactElement {
  const user = useAuthStore((s) => s.user);
  const slug = user?.entity?.slug ?? "";
  const entityId = user?.entity?.id;
  const isAdmin = (user?.roles ?? []).includes("admin");
  const isSecretario = (user?.roles ?? []).includes("secretario");
  const puedeCrearEvidencia = Boolean(
    isAdmin || isSecretario || (user?.roles ?? []).includes("superadmin") || user?.is_superuser,
  );
  const invalidatePdm = useInvalidatePdm();

  const [vista, setVista] = useState<VistaPdm>("dashboard");
  const [procesandoExcel, setProcesandoExcel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
  const [anioDetalle, setAnioDetalle] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [filtroLinea, setFiltroLinea] = useState("");
  const [filtroSector, setFiltroSector] = useState("");
  const [filtroSecretaria, setFiltroSecretaria] = useState("");
  const [filtroOds, setFiltroOds] = useState("");
  const [filtroTipoAcumulacion, setFiltroTipoAcumulacion] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState<ResumenProducto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalContratos, setModalContratos] = useState(false);
  const [modalEjecucion, setModalEjecucion] = useState(false);
  const [anioContratos, setAnioContratos] = useState(2026);
  const [anioEjecucion, setAnioEjecucion] = useState(2026);
  const [archivoContratos, setArchivoContratos] = useState<File | null>(null);
  const [archivoEjecucion, setArchivoEjecucion] = useState<File | null>(null);
  const [mostrarModalActividad, setMostrarModalActividad] = useState(false);
  const [actividadEnEdicion, setActividadEnEdicion] = useState<PdmActividad | null>(null);
  const [cargandoActividadesBackend, setCargandoActividadesBackend] = useState(false);
  const [guardandoEvidencia, setGuardandoEvidencia] = useState(false);
  const [ejecucionPresupuestal, setEjecucionPresupuestal] = useState<PdmEjecucionProducto | null>(null);
  const [cargandoEjecucion, setCargandoEjecucion] = useState(false);
  const [contratosRPS, setContratosRPS] = useState<ContratosRPSResumen | null>(null);
  const [cargandoContratos, setCargandoContratos] = useState(false);
  const [mostrarModalBpin, setMostrarModalBpin] = useState(false);
  const [proyectoBpin, setProyectoBpin] = useState<ProyectoBpin | null>(null);
  const [cargandoBpin, setCargandoBpin] = useState(false);
  const [errorBpin, setErrorBpin] = useState<string | null>(null);
  const [consultaUrlBpin, setConsultaUrlBpin] = useState<string | null>(null);
  const [portalUrlBpin, setPortalUrlBpin] = useState<string | null>(null);

  const { data: status, isLoading: loadingStatus } = usePdmStatus(slug, Boolean(slug));
  const tieneDatos = Boolean(status?.tiene_datos);

  const { data: meta } = usePdmMeta(slug, tieneDatos);
  const { data: statsData } = usePdmStats(slug, filtroAnio, tieneDatos && vista !== "detalle");
  const estadisticas = statsData ? statsFromApi(statsData) : null;
  const statsEstado = statsData?.estado_por_anio ?? {
    pendiente: 0,
    en_progreso: 0,
    completado: 0,
    por_ejecutar: 0,
    total: 0,
  };

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
      ...(filtroBusqueda.trim() ? { search: filtroBusqueda.trim() } : {}),
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
      filtroBusqueda,
    ],
  );

  const { data: productosPage, isLoading: loadingProductos } = usePdmProductos(
    slug,
    listParams,
    tieneDatos && vista === "productos",
  );
  const resumenProductos = useMemo(
    () => (productosPage?.results ?? []).map(mapProductoToResumen),
    [productosPage],
  );
  const totalCount = productosPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias", entityId],
    queryFn: () => secretariasApi.list(entityId!),
    enabled: Boolean(entityId),
  });

  const { data: resumenEjecucion } = useQuery<ResumenEjecucionAnual | null>({
    queryKey: ["pdm", "ejecucion-anual"],
    queryFn: () => pdmApi.resumenEjecucionAnualEntidad(),
    enabled: tieneDatos,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroAnio, filtroLinea, filtroSector, filtroSecretaria, filtroOds, filtroTipoAcumulacion, filtroEstado, filtroBusqueda]);

  function limpiarFiltros() {
    setFiltroLinea("");
    setFiltroSector("");
    setFiltroSecretaria("");
    setFiltroOds("");
    setFiltroTipoAcumulacion("");
    setFiltroEstado("");
    setFiltroBusqueda("");
  }

  function volver() {
    if (vista === "detalle") setVista("productos");
    else setVista("dashboard");
  }

  async function cargarEjecucionPresupuestal(codigo: string, anio: number) {
    setCargandoEjecucion(true);
    setEjecucionPresupuestal(null);
    try {
      setEjecucionPresupuestal(await pdmApi.ejecucionPorProducto(codigo, anio));
    } catch {
      setEjecucionPresupuestal(null);
    } finally {
      setCargandoEjecucion(false);
    }
  }

  async function cargarContratosRPS(codigo: string, anio: number) {
    if (!slug) return;
    setCargandoContratos(true);
    setContratosRPS(null);
    try {
      const data = await pdmApi.contratos(slug, anio, codigo);
      setContratosRPS({ ...data, anio: data.anio ?? anio });
    } catch {
      setContratosRPS(null);
    } finally {
      setCargandoContratos(false);
    }
  }

  async function sincronizarActividadesProducto(codigo: string, anio?: number) {
    if (!slug) return [];
    setCargandoActividadesBackend(true);
    try {
      const actividades = await pdmApi.actividadesByProducto(slug, codigo, anio);
      setProductoSeleccionado((prev) => (prev && prev.codigo === codigo ? { ...prev, actividades } : prev));
      return actividades;
    } finally {
      setCargandoActividadesBackend(false);
    }
  }

  async function openDetalle(producto: ResumenProducto) {
    setProductoSeleccionado(producto);
    setAnioDetalle(filtroAnio);
    setVista("detalle");
    await Promise.all([
      slug
        ? pdmApi
            .productoDetail(slug, producto.codigo, filtroAnio)
            .then((detail) => setProductoSeleccionado(mapProductoToResumen(detail)))
            .catch(() => undefined)
        : Promise.resolve(),
      cargarEjecucionPresupuestal(producto.codigo, filtroAnio),
      cargarContratosRPS(producto.codigo, filtroAnio),
    ]);
  }

  async function seleccionarAnioDetalle(anio: number) {
    setAnioDetalle(anio);
    if (!productoSeleccionado || !slug) return;
    await Promise.all([
      pdmApi
        .productoDetail(slug, productoSeleccionado.codigo, anio)
        .then((detail) => setProductoSeleccionado(mapProductoToResumen(detail)))
        .catch(() => undefined),
      cargarEjecucionPresupuestal(productoSeleccionado.codigo, anio),
      cargarContratosRPS(productoSeleccionado.codigo, anio),
    ]);
  }

  const resumenAnioDetalle = useMemo(() => {
    if (!productoSeleccionado) return null;
    return obtenerResumenActividadesPorAnio(productoSeleccionado, anioDetalle);
  }, [productoSeleccionado, anioDetalle]);

  const comparativaPresupuestal = useMemo(() => {
    if (!productoSeleccionado) return [];
    const pdm = getPresupuestoAnio(productoSeleccionado, anioDetalle);
    const ptoDefinitivo = Number(ejecucionPresupuestal?.totales?.pto_definitivo || 0);
    const pagos = Number(ejecucionPresupuestal?.totales?.pagos || 0);
    return [
      {
        anio: anioDetalle,
        pdm,
        ptoDefinitivo,
        pagos,
        porcentaje: ptoDefinitivo > 0 ? (pagos / ptoDefinitivo) * 100 : 0,
      },
    ];
  }, [productoSeleccionado, anioDetalle, ejecucionPresupuestal]);

  async function guardarActividad(values: ActividadFormValues) {
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
        imagenes: values.imagenes.length ? values.imagenes : [],
      };
      if (actividadEnEdicion?.evidencia?.id || actividadEnEdicion?.tiene_evidencia) {
        await pdmApi.actualizarEvidencia(slug, actividad.id, evidenciaPayload);
      } else {
        await pdmApi.registrarEvidencia(slug, actividad.id, evidenciaPayload);
      }
      await sincronizarActividadesProducto(productoSeleccionado.codigo, anioDetalle);
      invalidatePdm();
      setMostrarModalActividad(false);
      setActividadEnEdicion(null);
    } catch (e) {
      setError(formatApiError(e as never, "No se pudo guardar la actividad."));
    } finally {
      setGuardandoEvidencia(false);
      setSaving(false);
    }
  }

  async function handleExcelSelected(file: File | null) {
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
      const parsed = await procesarArchivoExcel(file);
      if (parsed.productos_plan_indicativo.length === 0) {
        throw new Error("No se encontraron productos en la hoja 'Plan Indicativo - Productos'.");
      }
      await pdmApi.upload(slug, buildPdmUploadPayload(parsed));
      invalidatePdm();
      setVista("dashboard");
    } catch (e) {
      setError(formatApiError(e as never, "No se pudo procesar el archivo."));
    } finally {
      setProcesandoExcel(false);
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const loading = loadingStatus || procesandoExcel;

  if (loading) {
    return <PdmLoadingOverlay message={procesandoExcel ? "Procesando Excel..." : "Cargando PDM..."} />;
  }

  const pageTitle = !tieneDatos
    ? "Plan de Desarrollo Municipal"
    : vista === "dashboard"
      ? "Seguimiento PDM"
      : vista === "productos"
        ? "Productos"
        : "Detalle del producto";

  const headerSubtitle = !tieneDatos
    ? "Cargue el Excel del plan indicativo (5 hojas)"
    : isSecretario && !isAdmin
      ? "Productos asignados a su secretaría"
      : vista === "dashboard"
        ? "Seguimiento del Plan de Desarrollo Municipal"
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
          {tieneDatos && vista === "dashboard" && (
            <button type="button" onClick={() => setVista("productos")} className={pdmBtnPrimary}>
              <FileSpreadsheet className="h-4 w-4" /> Ver productos
            </button>
          )}
          {tieneDatos && isAdmin && (
            <PdmAccionesMenu
              disabled={saving}
              onContratos={() => setModalContratos(true)}
              onEjecucion={() => setModalEjecucion(true)}
              onRecargarPdm={() => fileInputRef.current?.click()}
            />
          )}
        </div>
      </div>

      {error && <PdmAlert tone="error">{error}</PdmAlert>}

      {!tieneDatos && (
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

      {tieneDatos && vista === "dashboard" && estadisticas && (
        <PdmDashboard
          estadisticas={estadisticas}
          resumenEjecucion={resumenEjecucion ?? null}
          onVerProductos={() => setVista("productos")}
        />
      )}

      {tieneDatos && vista === "productos" && (
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
          onOpenDetalle={(p) => void openDetalle(p)}
          onAsignar={async (p, sid) => {
            if (!slug || !sid) return;
            setSaving(true);
            try {
              await pdmApi.asignarResponsable(slug, p.codigo, sid);
              invalidatePdm();
            } catch (e) {
              setError(formatApiError(e as never, "No se pudo asignar."));
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {tieneDatos && vista === "detalle" && productoSeleccionado && resumenAnioDetalle && (
        <PdmProductoDetalle
          producto={productoSeleccionado}
          anioDetalle={anioDetalle}
          onAnioDetalle={(a) => void seleccionarAnioDetalle(a)}
          resumenAnioDetalle={resumenAnioDetalle}
          comparativaPresupuestal={comparativaPresupuestal}
          ejecucionPresupuestal={ejecucionPresupuestal}
          cargandoEjecucion={cargandoEjecucion}
          contratosRPS={contratosRPS}
          cargandoContratos={cargandoContratos}
          cargandoActividadesBackend={cargandoActividadesBackend}
          saving={saving}
          puedeCrearEvidencia={puedeCrearEvidencia}
          isAdmin={isAdmin}
          onNuevaActividad={() => {
            setActividadEnEdicion(null);
            setMostrarModalActividad(true);
          }}
          onEditarActividad={(a) => {
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
          }}
          onEliminarActividad={async (a) => {
            if (!slug || !window.confirm("¿Eliminar actividad?")) return;
            setSaving(true);
            try {
              await pdmApi.eliminarActividad(slug, a.id);
              await sincronizarActividadesProducto(productoSeleccionado.codigo, anioDetalle);
              invalidatePdm();
            } catch (e) {
              setError(formatApiError(e as never, "No se pudo eliminar."));
            } finally {
              setSaving(false);
            }
          }}
          onCargarEvidencia={async (a) => {
            if (!slug) return;
            try {
              const ev = await pdmApi.getEvidencia(slug, a.id);
              setProductoSeleccionado((prev) =>
                prev
                  ? {
                      ...prev,
                      actividades: prev.actividades.map((x) =>
                        x.id === a.id ? { ...x, evidencia: ev, tiene_evidencia: true } : x,
                      ),
                    }
                  : prev,
              );
            } catch {
              /* ignore */
            }
          }}
          unidad={productoSeleccionado.unidad_medida || "N/D"}
          onAbrirBpin={(bpin) => {
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
                setErrorBpin(formatApiError(e as never, "Error al consultar datos.gov.co."));
              })
              .finally(() => setCargandoBpin(false));
          }}
        />
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
                    await pdmApi.uploadEjecucion(archivoEjecucion, anioEjecucion);
                    invalidatePdm();
                    setModalEjecucion(false);
                  } catch (e) {
                    setError(formatApiError(e as never, "Error al cargar."));
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
        <input
          type="file"
          className="mt-4 block w-full text-sm"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setArchivoEjecucion(e.target.files?.[0] || null)}
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
                    await pdmApi.uploadContratos(slug, archivoContratos, anioContratos);
                    setModalContratos(false);
                  } catch (e) {
                    setError(formatApiError(e as never, "Error al cargar."));
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
        <input type="file" className="mt-4 block w-full text-sm" accept=".xlsx,.xls,.csv" onChange={(e) => setArchivoContratos(e.target.files?.[0] || null)} />
      </PdmModal>

      {productoSeleccionado && (
        <PdmActividadModal
          open={mostrarModalActividad}
          anio={anioDetalle}
          producto={productoSeleccionado}
          secretarias={secretarias}
          actividadEnEdicion={actividadEnEdicion}
          secretariaUsuarioId={user?.secretaria?.id}
          esSecretario={isSecretario}
          saving={guardandoEvidencia || saving}
          onClose={() => {
            setMostrarModalActividad(false);
            setActividadEnEdicion(null);
          }}
          onSave={guardarActividad}
        />
      )}

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
    </div>
  );
}
