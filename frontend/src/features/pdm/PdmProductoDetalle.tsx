import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  ExternalLink,
  Inbox,
  Info,
  Loader2,
  Plus,
  Scale,
  Target,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { PdmActividad, PdmContrato, PdmEjecucionProducto, PdmEvidenciaArchivo } from "@/core/api/pdm";
import { fetchAuthenticatedFile } from "@/core/api/client";
import {
  PdmAlert,
  PdmBadge,
  PdmBtn,
  PdmCard,
  PdmProgressBar,
} from "@/features/pdm/components/PdmUi";
import {
  ANIOS_PDM,
  etiquetaFuentePresupuestal,
  esCodigoFuentePresupuestal,
  formatearMoneda,
  formatearNumero,
  formatFechaCorta,
  formatFechaHora,
  getAniosConMetas,
  getAvanceAnio,
  getColorEstadoActividad,
  getColorProgreso,
  getPresupuestoAnio,
  getTextoEstadoActividad,
  type ResumenActividadesAnio,
  type ResumenProducto,
} from "@/features/pdm/pdmUtils";

export interface ComparativaPresupuestalRow {
  anio: number;
  pdm: number;
  ptoDefinitivo: number;
  pagos: number;
  porcentaje: number;
}

export interface ContratosRPSResumen {
  contratos: PdmContrato[];
  total_contratado: number;
  cantidad_contratos: number;
  anio: number;
}

export interface PdmProductoDetalleProps {
  producto: ResumenProducto;
  anioDetalle: number;
  onAnioDetalle: (anio: number) => void;
  resumenAnioDetalle: ResumenActividadesAnio | null;
  comparativaPresupuestal: ComparativaPresupuestalRow[];
  ejecucionPresupuestal: PdmEjecucionProducto | null;
  cargandoEjecucion: boolean;
  contratosRPS: ContratosRPSResumen | null;
  cargandoContratos: boolean;
  cargandoActividadesBackend: boolean;
  saving: boolean;
  puedeCrearEvidencia: boolean;
  isAdmin: boolean;
  onNuevaActividad: () => void;
  onEditarActividad: (actividad: PdmActividad) => void;
  onEliminarActividad: (actividad: PdmActividad) => void;
  onCargarEvidencia: (actividad: PdmActividad) => void;
  onAbrirBpin: (bpin: string) => void;
  unidad: string;
}

const PRESUPUESTO_ANIO_TONES = ["blue", "cyan", "amber", "emerald"] as const;

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{children}</p>;
}

function FieldValue({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-0.5 text-sm font-medium text-slate-800 ${className}`}>{children}</p>;
}

function pctEjecutadoColor(pct: number): string {
  if (pct >= 95) return "text-emerald-600";
  if (pct >= 70) return "text-amber-600";
  return "text-red-600";
}

export default function PdmProductoDetalle({
  producto,
  anioDetalle,
  onAnioDetalle,
  resumenAnioDetalle,
  comparativaPresupuestal,
  ejecucionPresupuestal,
  cargandoEjecucion,
  contratosRPS,
  cargandoContratos,
  cargandoActividadesBackend,
  saving,
  puedeCrearEvidencia,
  isAdmin,
  onNuevaActividad,
  onEditarActividad,
  onEliminarActividad,
  onCargarEvidencia,
  onAbrirBpin,
  unidad,
}: PdmProductoDetalleProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main column */}
      <div className="space-y-6 lg:col-span-2">
        <PdmCard
          title="Información del Producto"
          icon={<Info size={16} className="text-blue-600" />}
          headerClassName="bg-blue-50/80"
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Código Producto</FieldLabel>
                <FieldValue>{producto.codigo}</FieldValue>
              </div>
              <div>
                <FieldLabel>Unidad de Medida</FieldLabel>
                <FieldValue>{producto.unidad_medida || "N/D"}</FieldValue>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Producto (MGA)</FieldLabel>
                <FieldValue>{producto.producto_mga || "N/D"}</FieldValue>
              </div>
              <div>
                <FieldLabel>Indicador de Producto (MGA)</FieldLabel>
                <FieldValue>{producto.indicador_producto_mga || "N/D"}</FieldValue>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel>Línea Estratégica</FieldLabel>
                <FieldValue>{producto.linea_estrategica || "N/D"}</FieldValue>
              </div>
              <div>
                <FieldLabel>Sector MGA</FieldLabel>
                <FieldValue>{producto.sector || "N/D"}</FieldValue>
              </div>
              <div>
                <FieldLabel>Programa MGA</FieldLabel>
                <FieldValue>{producto.programa_mga || "N/A"}</FieldValue>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel>ODS</FieldLabel>
                <div className="mt-1">
                  <PdmBadge tone="info">{producto.ods || "N/A"}</PdmBadge>
                </div>
              </div>
              <div>
                <FieldLabel>Tipo de Acumulación</FieldLabel>
                <FieldValue>{producto.tipo_acumulacion || "N/A"}</FieldValue>
              </div>
              <div>
                <FieldLabel>BPIN</FieldLabel>
                {producto.bpin ? (
                  <button
                    type="button"
                    onClick={() => onAbrirBpin(producto.bpin!)}
                    className="mt-0.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {producto.bpin}
                  </button>
                ) : (
                  <FieldValue>N/A</FieldValue>
                )}
              </div>
            </div>

            <hr className="border-slate-200" />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel>Meta Cuatrienio</FieldLabel>
                <p className="mt-0.5 text-2xl font-bold text-blue-600">{formatearNumero(producto.meta_cuatrienio || 0)}</p>
                <p className="text-xs text-slate-500">{unidad}</p>
              </div>
              <div>
                <FieldLabel>Metas Programadas</FieldLabel>
                <p className="mt-0.5 text-2xl font-bold text-cyan-600">{getAniosConMetas(producto)}</p>
                <p className="text-xs text-slate-500">años con metas</p>
              </div>
              <div>
                <FieldLabel>% de Avance</FieldLabel>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">{producto.porcentaje_ejecucion.toFixed(1)}%</p>
              </div>
            </div>

            <PdmProgressBar value={producto.porcentaje_ejecucion} tone={getColorProgreso(producto.porcentaje_ejecucion)} />
          </div>
        </PdmCard>

        <PdmCard
          title={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span>Actividades y Seguimiento</span>
              <div className="flex items-center gap-3">
                {cargandoActividadesBackend && (
                  <span className="flex items-center gap-1.5 text-xs font-normal text-slate-500">
                    <Loader2 size={14} className="animate-spin" />
                    Cargando datos del servidor...
                  </span>
                )}
                {puedeCrearEvidencia && resumenAnioDetalle && resumenAnioDetalle.meta_disponible > 0 && (
                  <PdmBtn size="sm" onClick={onNuevaActividad} disabled={cargandoActividadesBackend || saving}>
                    <Plus size={14} />
                    Nueva Evidencia de Ejecución
                  </PdmBtn>
                )}
              </div>
            </div>
          }
        >
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
            {ANIOS_PDM.map((anio) => (
              <button
                key={anio}
                type="button"
                onClick={() => onAnioDetalle(anio)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  anioDetalle === anio
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {anio}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    anioDetalle === anio ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-800"
                  }`}
                >
                  {getAvanceAnio(producto, anio).toFixed(0)}%
                </span>
              </button>
            ))}
          </div>

          {cargandoActividadesBackend && (
            <PdmAlert tone="info">
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <strong>Cargando actividades desde el servidor...</strong>
              </span>
            </PdmAlert>
          )}

          {resumenAnioDetalle && (
            <PdmAlert tone="info">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <strong className="block text-slate-800">Meta Programada</strong>
                  <p>
                    {formatearNumero(resumenAnioDetalle.meta_programada)} {unidad}
                  </p>
                </div>
                <div>
                  <strong className="block text-slate-800">Meta Asignada</strong>
                  <p>
                    {formatearNumero(resumenAnioDetalle.meta_asignada)} {unidad}
                  </p>
                </div>
                <div>
                  <strong className="block text-slate-800">Meta Disponible</strong>
                  <p className={resumenAnioDetalle.meta_disponible === 0 ? "font-semibold text-red-600" : undefined}>
                    {formatearNumero(resumenAnioDetalle.meta_disponible)} {unidad}
                  </p>
                </div>
                <div>
                  <strong className="block text-slate-800">Avance del Año</strong>
                  <p className="flex flex-wrap items-center gap-2">
                    {resumenAnioDetalle.actividades_completadas} / {resumenAnioDetalle.total_actividades} evidencias
                    <PdmBadge tone={getColorProgreso(resumenAnioDetalle.porcentaje_avance)}>
                      {resumenAnioDetalle.porcentaje_avance.toFixed(1)}%
                    </PdmBadge>
                  </p>
                </div>
              </div>
            </PdmAlert>
          )}

          {resumenAnioDetalle && (
            <div className="mt-6">
              {resumenAnioDetalle.actividades.length === 0 ? (
                <div className="py-10 text-center">
                  <Inbox size={48} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">No hay actividades registradas para este año.</p>
                  {puedeCrearEvidencia && resumenAnioDetalle.meta_disponible > 0 && (
                    <PdmBtn className="mt-4" onClick={onNuevaActividad}>
                      <Plus size={14} />
                      Crear Primera Actividad
                    </PdmBtn>
                  )}
                  {resumenAnioDetalle.meta_disponible === 0 && (
                    <div className="mx-auto mt-4 max-w-md">
                      <PdmAlert tone="warning">No hay meta disponible para crear actividades en este año.</PdmAlert>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {resumenAnioDetalle.actividades.map((actividad) => (
                    <ActividadCard
                      key={actividad.id}
                      actividad={actividad}
                      unidad={unidad}
                      puedeCrearEvidencia={puedeCrearEvidencia}
                      isAdmin={isAdmin}
                      onEditar={() => onEditarActividad(actividad)}
                      onEliminar={() => onEliminarActividad(actividad)}
                      onCargarEvidencia={() => onCargarEvidencia(actividad)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </PdmCard>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <PdmCard title="Resumen Presupuestal">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">Presupuesto Total</span>
            <strong className="text-emerald-600">{formatearMoneda(producto.total_cuatrienio)}</strong>
          </div>
          <div className="space-y-3">
            {ANIOS_PDM.map((anio, idx) => {
              const total = getPresupuestoAnio(producto, anio);
              const pct = producto.total_cuatrienio ? (total / producto.total_cuatrienio) * 100 : 0;
              return (
                <div key={anio}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{anio}</span>
                    <span className="font-medium text-slate-700">{formatearMoneda(total)}</span>
                  </div>
                  <PdmProgressBar value={pct} tone={PRESUPUESTO_ANIO_TONES[idx]} showLabel={false} />
                </div>
              );
            })}
          </div>
        </PdmCard>

        {(ejecucionPresupuestal || cargandoEjecucion) && (
          <PdmCard title="Comparativa Presupuestal" icon={<Scale size={16} className="text-slate-600" />}>
            {cargandoEjecucion ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Cargando ejecución presupuestal...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-2 font-medium">Año</th>
                        <th className="pb-2 pr-2 text-right font-medium">Presupuesto PPI</th>
                        <th className="pb-2 pr-2 text-right font-medium">Pto. Definitivo</th>
                        <th className="pb-2 pr-2 text-right font-medium">Pagos Reales</th>
                        <th className="pb-2 text-right font-medium">% Ejecutado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativaPresupuestal.map((comp) => (
                        <tr key={comp.anio} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-2 font-semibold text-slate-800">{comp.anio}</td>
                          <td className="py-2 pr-2 text-right text-slate-700">{formatearMoneda(comp.pdm)}</td>
                          <td className="py-2 pr-2 text-right text-slate-700">{formatearMoneda(comp.ptoDefinitivo)}</td>
                          <td className="py-2 pr-2 text-right font-bold text-blue-600">{formatearMoneda(comp.pagos)}</td>
                          <td className={`py-2 text-right font-bold ${pctEjecutadoColor(comp.porcentaje)}`}>
                            {comp.porcentaje.toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PdmAlert tone="info">
                  <strong>Nota:</strong> El <strong>Pto. Definitivo</strong> es el presupuesto real asignado al producto
                  (después de adiciones y reducciones). Los <strong className="text-blue-600">Pagos Reales</strong> son lo
                  efectivamente ejecutado. El <strong>% Ejecutado</strong> se calcula: Pagos / Pto. Definitivo.
                </PdmAlert>
              </>
            )}
          </PdmCard>
        )}

        <PdmCard title="Información Adicional" icon={<Info size={16} className="text-slate-600" />}>
          {cargandoEjecucion ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Cargando ejecución presupuestal...
            </div>
          ) : ejecucionPresupuestal ? (
            <>
              {ejecucionPresupuestal.fuentes_detalle?.length ? (
                <div className="space-y-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fuentes Presupuestales</p>
                  {ejecucionPresupuestal.fuentes_detalle.map((fuente, idx) => (
                    <div key={`${fuente.nombre}-${idx}`} className={idx > 0 ? "border-t border-slate-100 pt-4" : undefined}>
                      <p className="mb-2 text-sm font-semibold text-slate-800">{etiquetaFuentePresupuestal(fuente)}</p>
                      {esCodigoFuentePresupuestal(fuente.nombre) && (
                        <p className="mb-2 text-xs text-slate-500">
                          Código fuente: {fuente.nombre}. Vuelva a cargar el Excel de ejecución para mostrar el nombre
                          descriptivo.
                        </p>
                      )}
                      <FuentePresupuestalTable fuente={fuente} />
                    </div>
                  ))}
                  {ejecucionPresupuestal.fuentes_detalle.length > 1 && (
                    <div className="border-t border-slate-100 pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Total Consolidado</p>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr>
                            <td className="py-1 text-slate-500">Pto. Definitivo:</td>
                            <td className="py-1 text-right font-semibold">{formatearMoneda(ejecucionPresupuestal.totales.pto_definitivo)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 font-medium text-blue-600">Pagos:</td>
                            <td className="py-1 text-right font-bold text-blue-600">
                              {formatearMoneda(ejecucionPresupuestal.totales.pagos)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <PdmAlert tone="info">Ejecución presupuestal disponible sin desglose por fuente.</PdmAlert>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <FieldLabel>Programa MGA</FieldLabel>
                <p className="text-sm text-slate-600">{producto.programa_mga || "N/A"}</p>
              </div>
              <div>
                <FieldLabel>ODS</FieldLabel>
                <p className="text-sm text-slate-600">{producto.ods || "N/A"}</p>
              </div>
              <div>
                <FieldLabel>Tipo de Acumulación</FieldLabel>
                <p className="text-sm text-slate-600">{producto.tipo_acumulacion || "N/A"}</p>
              </div>
              <PdmAlert tone="info">
                No hay datos de ejecución presupuestal disponibles para este producto en {anioDetalle}.
              </PdmAlert>
            </div>
          )}

          {cargandoContratos ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Cargando contratos RPS...
            </div>
          ) : contratosRPS && contratosRPS.cantidad_contratos > 0 ? (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contratos RPS ({anioDetalle})
              </p>
              <PdmAlert tone="info">
                <strong>{contratosRPS.cantidad_contratos}</strong> contrato(s) · Total contratado:{" "}
                <strong>{formatearMoneda(contratosRPS.total_contratado)}</strong>
              </PdmAlert>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-2 font-medium">No. CRP</th>
                      <th className="pb-2 pr-2 font-medium">Concepto</th>
                      <th className="pb-2 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratosRPS.contratos.map((contrato) => (
                      <tr key={contrato.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-2 font-semibold text-slate-800">{contrato.no_crp}</td>
                        <td className="py-2 pr-2 text-slate-600">{contrato.concepto || "Sin concepto"}</td>
                        <td className="py-2 text-right font-bold text-emerald-600">{formatearMoneda(contrato.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </PdmCard>
      </div>
    </div>
  );
}

function FuentePresupuestalTable({ fuente }: { fuente: PdmEjecucionProducto["fuentes_detalle"][number] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr>
          <td className="py-1 text-slate-500">Pto. Inicial:</td>
          <td className="py-1 text-right">{formatearMoneda(fuente.pto_inicial)}</td>
        </tr>
        <tr>
          <td className="py-1 text-emerald-600">Adición:</td>
          <td className="py-1 text-right text-emerald-600">+{formatearMoneda(fuente.adicion)}</td>
        </tr>
        <tr>
          <td className="py-1 text-red-600">Reducción:</td>
          <td className="py-1 text-right text-red-600">-{formatearMoneda(fuente.reduccion)}</td>
        </tr>
        {fuente.credito > 0 && (
          <tr>
            <td className="py-1 text-slate-500">Crédito:</td>
            <td className="py-1 text-right">{formatearMoneda(fuente.credito)}</td>
          </tr>
        )}
        {fuente.contracredito > 0 && (
          <tr>
            <td className="py-1 text-slate-500">Contracrédito:</td>
            <td className="py-1 text-right">{formatearMoneda(fuente.contracredito)}</td>
          </tr>
        )}
        <tr>
          <td className="py-1 font-semibold text-slate-800">Pto. Definitivo:</td>
          <td className="py-1 text-right font-semibold">{formatearMoneda(fuente.pto_definitivo)}</td>
        </tr>
        <tr>
          <td className="py-1 font-medium text-blue-600">Pagos:</td>
          <td className="py-1 text-right font-bold text-blue-600">{formatearMoneda(fuente.pagos)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function AuthenticatedImage({
  url,
  alt,
  className = "",
  onClick,
}: {
  url: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    void fetchAuthenticatedFile(url).then((blob) => {
      if (cancelled) return;
      blobUrl = URL.createObjectURL(blob);
      setSrc(blobUrl);
    });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <Loader2 size={18} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onClick={onClick} />;
}

function AuthenticatedImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    void fetchAuthenticatedFile(url).then((blob) => {
      if (cancelled) return;
      blobUrl = URL.createObjectURL(blob);
      setSrc(blobUrl);
    });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X size={24} />
      </button>
      {src ? (
        <img src={src} alt="Evidencia ampliada" className="max-h-[90vh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
      ) : (
        <Loader2 size={32} className="animate-spin text-white" />
      )}
    </div>
  );
}

function ActividadCard({
  actividad,
  unidad,
  puedeCrearEvidencia,
  isAdmin,
  onEditar,
  onEliminar,
  onCargarEvidencia,
}: {
  actividad: PdmActividad;
  unidad: string;
  puedeCrearEvidencia: boolean;
  isAdmin: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  onCargarEvidencia: () => void;
}) {
  const [imagenModal, setImagenModal] = useState<PdmEvidenciaArchivo | null>(null);
  const tieneEvidencia = actividad.tiene_evidencia || actividad.evidencia;
  const archivos = actividad.evidencia?.archivos || [];

  return (
    <>
      <div className="actividad-card overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition duration-300 hover:translate-x-1 hover:shadow-md">
        <div className="border-l-4 border-[#4e73df] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h6 className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                {actividad.nombre}
                <PdmBadge tone={getColorEstadoActividad(actividad.estado)}>
                  {getTextoEstadoActividad(actividad.estado)}
                </PdmBadge>
                {actividad.evidencia && (
                  <PdmBadge tone="success">
                    <CheckCircle2 size={12} className="mr-1 inline" />
                    Con Evidencia
                  </PdmBadge>
                )}
              </h6>
              <p className="mb-2 text-sm text-slate-500">{actividad.descripcion || "Sin descripción"}</p>
              <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <div className="flex items-start gap-1.5">
                  <User size={12} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    <strong>Responsable:</strong> {actividad.responsable_secretaria_nombre || "Sin asignar"}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Calendar size={12} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    <strong>Fechas:</strong> {formatFechaCorta(actividad.fecha_inicio)} - {formatFechaCorta(actividad.fecha_fin)}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Target size={12} className="mt-0.5 shrink-0 text-slate-400" />
                  <span>
                    <strong>Meta:</strong> {formatearNumero(actividad.meta_ejecutar)} {unidad}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5 sm:ml-3">
              {puedeCrearEvidencia && (!actividad.tiene_evidencia || isAdmin) && (
                <PdmBtn
                  variant="outline"
                  size="sm"
                  onClick={onEditar}
                  title={actividad.tiene_evidencia ? "Editar Evidencia (Admin)" : "Agregar Evidencia"}
                >
                  <Edit size={14} />
                </PdmBtn>
              )}
              {(!actividad.tiene_evidencia || isAdmin) && (
                <PdmBtn
                  variant="danger"
                  size="sm"
                  onClick={onEliminar}
                  title={actividad.tiene_evidencia ? "Eliminar (Admin - incluye evidencia)" : "Eliminar"}
                >
                  <Trash2 size={14} />
                </PdmBtn>
              )}
            </div>
          </div>

          {tieneEvidencia && (
            <div className="mt-3 rounded-lg bg-slate-100 p-3">
              {actividad.tiene_evidencia && !actividad.evidencia && !actividad.cargandoEvidencia && (
                <button
                  type="button"
                  onClick={onCargarEvidencia}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 py-3 text-sm text-slate-500 transition hover:text-slate-700"
                >
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Tiene evidencia - Clic para cargar
                </button>
              )}

              {actividad.cargandoEvidencia && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  Cargando evidencia...
                </div>
              )}

              {actividad.evidencia && (
                <div>
                  <h6 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 size={16} />
                    Evidencia de Cumplimiento
                  </h6>
                  {actividad.evidencia.descripcion &&
                    actividad.evidencia.descripcion.trim().toLowerCase() !==
                      (actividad.descripcion || "").trim().toLowerCase() && (
                      <p className="mb-2 text-sm text-slate-700">
                        <strong>Descripción evidencia:</strong> {actividad.evidencia.descripcion}
                      </p>
                    )}
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={12} />
                    Registrado el {formatFechaHora(actividad.evidencia.fecha_registro)}
                  </p>
                  {actividad.evidencia.url_evidencia && (
                    <div className="mb-2">
                      <a
                        href={actividad.evidencia.url_evidencia}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        <ExternalLink size={12} />
                        Ver Evidencia Externa
                      </a>
                    </div>
                  )}
                  {archivos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {archivos.map((archivo) => (
                        <button
                          key={archivo.id}
                          type="button"
                          onClick={() => setImagenModal(archivo)}
                          className="overflow-hidden rounded-md border border-slate-300 bg-[#f0f0f0] p-0 transition hover:opacity-90"
                        >
                          <AuthenticatedImage
                            url={archivo.url}
                            alt={archivo.nombre}
                            className="min-h-[100px] w-full cursor-pointer object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {imagenModal && <AuthenticatedImageModal url={imagenModal.url} onClose={() => setImagenModal(null)} />}
    </>
  );
}
