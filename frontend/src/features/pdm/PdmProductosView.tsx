import { memo } from "react";
import { Box, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, Search, X } from "lucide-react";
import type { Secretaria } from "@/core/api/entities";
import type { PdmMetaResponse } from "@/core/api/pdm";
import {
  ANIOS_PDM,
  formatearMoneda,
  formatearNumero,
  getAvanceAnio,
  getColorEstadoProducto,
  getColorProgreso,
  getEstadoProductoAnio,
  getMetaAnio,
  getPresupuestoAnio,
  getTextoEstadoProducto,
  type ResumenProducto,
} from "@/features/pdm/pdmUtils";
import { PdmBadge, PdmCard, PdmProgressBar, PdmStatCard, PdmYearPills } from "@/features/pdm/components/PdmUi";
import { pdmBtnSecondary, pdmInput, pdmSelect } from "@/features/pdm/pdmLayout";

interface PdmProductosViewProps {
  filtroAnio: number;
  onFiltroAnio: (anio: number) => void;
  meta: PdmMetaResponse | undefined;
  secretarias: Secretaria[];
  isAdmin: boolean;
  saving: boolean;
  productos: ResumenProducto[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  statsEstado: { pendiente: number; en_progreso: number; completado: number; por_ejecutar: number; total: number };
  filtroLinea: string;
  filtroSector: string;
  filtroSecretaria: string;
  filtroOds: string;
  filtroTipoAcumulacion: string;
  filtroEstado: string;
  filtroBusqueda: string;
  onFiltroLinea: (v: string) => void;
  onFiltroSector: (v: string) => void;
  onFiltroSecretaria: (v: string) => void;
  onFiltroOds: (v: string) => void;
  onFiltroTipoAcumulacion: (v: string) => void;
  onFiltroEstado: (v: string) => void;
  onFiltroBusqueda: (v: string) => void;
  onLimpiarFiltros: () => void;
  onPageChange: (page: number) => void;
  onOpenDetalle: (p: ResumenProducto) => void;
  onAsignar: (p: ResumenProducto, secretariaId: number) => void;
}

const ProductoRow = memo(function ProductoRow({
  producto,
  filtroAnio,
  isAdmin,
  saving,
  secretarias,
  onOpenDetalle,
  onAsignar,
}: {
  producto: ResumenProducto;
  filtroAnio: number;
  isAdmin: boolean;
  saving: boolean;
  secretarias: Secretaria[];
  onOpenDetalle: (p: ResumenProducto) => void;
  onAsignar: (p: ResumenProducto, secretariaId: number) => void;
}) {
  const avance = getAvanceAnio(producto, filtroAnio, filtroAnio);
  const estado = getEstadoProductoAnio(producto, filtroAnio, filtroAnio);

  return (
    <tr className="cursor-pointer transition hover:bg-blue-50/50" onClick={() => onOpenDetalle(producto)}>
      <td className="px-4 py-3">
        <PdmBadge tone="secondary">{producto.codigo}</PdmBadge>
      </td>
      <td className="max-w-xs px-4 py-3">
        <p className="font-medium text-slate-900 line-clamp-2">{producto.producto}</p>
        <p className="text-xs text-slate-500 line-clamp-1">{producto.sector}</p>
      </td>
      <td className="hidden px-4 py-3 text-center md:table-cell">
        {formatearNumero(producto.meta_cuatrienio || 0)}
      </td>
      <td className="px-4 py-3 text-center">{formatearNumero(getMetaAnio(producto, filtroAnio))}</td>
      <td className="hidden px-4 py-3 text-right font-medium text-emerald-700 lg:table-cell">
        {formatearMoneda(getPresupuestoAnio(producto, filtroAnio))}
      </td>
      <td className="min-w-[120px] px-4 py-3">
        <PdmProgressBar value={avance} tone={getColorProgreso(avance)} />
      </td>
      <td className="px-4 py-3 text-center">
        <PdmBadge tone={getColorEstadoProducto(estado)}>{getTextoEstadoProducto(estado)}</PdmBadge>
      </td>
      <td className="hidden px-4 py-3 xl:table-cell" onClick={(e) => e.stopPropagation()}>
        {isAdmin ? (
          <select
            className={pdmSelect}
            value={producto.responsable_secretaria || ""}
            disabled={saving}
            onChange={(e) => void onAsignar(producto, Number(e.target.value))}
          >
            <option value="">Asignar...</option>
            {secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-slate-600">{producto.responsable_secretaria_nombre || "—"}</span>
        )}
      </td>
    </tr>
  );
});

export default function PdmProductosView({
  filtroAnio,
  onFiltroAnio,
  meta,
  secretarias,
  isAdmin,
  saving,
  productos,
  totalCount,
  currentPage,
  totalPages,
  isLoading,
  statsEstado,
  filtroLinea,
  filtroSector,
  filtroSecretaria,
  filtroOds,
  filtroTipoAcumulacion,
  filtroEstado,
  filtroBusqueda,
  onFiltroLinea,
  onFiltroSector,
  onFiltroSecretaria,
  onFiltroOds,
  onFiltroTipoAcumulacion,
  onFiltroEstado,
  onFiltroBusqueda,
  onLimpiarFiltros,
  onPageChange,
  onOpenDetalle,
  onAsignar,
}: PdmProductosViewProps) {
  return (
    <div className="space-y-6">
      <PdmCard title="Año de Seguimiento" icon={<Calendar size={16} />}>
        <PdmYearPills years={ANIOS_PDM} selected={filtroAnio} onSelect={onFiltroAnio} />
      </PdmCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PdmStatCard
          label="Pendientes"
          hint={`Sin avance en ${filtroAnio}`}
          value={statsEstado.pendiente}
          icon={<Clock size={24} className="text-amber-500" />}
          accent="warning"
          onClick={() => onFiltroEstado("PENDIENTE")}
        />
        <PdmStatCard
          label="En Progreso"
          hint={`Con actividades en ${filtroAnio}`}
          value={statsEstado.en_progreso}
          icon={<Loader2 size={24} className="text-cyan-500" />}
          accent="info"
          onClick={() => onFiltroEstado("EN_PROGRESO")}
        />
        <PdmStatCard
          label="Completados"
          hint={`100% en ${filtroAnio}`}
          value={statsEstado.completado}
          icon={<CheckCircle2 size={24} className="text-emerald-500" />}
          accent="success"
          onClick={() => onFiltroEstado("COMPLETADO")}
        />
        <PdmStatCard
          label="Por Ejecutar"
          hint={`Programados ${filtroAnio}`}
          value={statsEstado.por_ejecutar}
          icon={<Calendar size={24} className="text-slate-500" />}
          onClick={() => onFiltroEstado("POR_EJECUTAR")}
        />
      </div>

      <PdmCard>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Línea Estratégica</label>
            <select className={pdmSelect} value={filtroLinea} onChange={(e) => onFiltroLinea(e.target.value)}>
              <option value="">Todas</option>
              {(meta?.lineas_estrategicas ?? []).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sector</label>
            <select className={pdmSelect} value={filtroSector} onChange={(e) => onFiltroSector(e.target.value)}>
              <option value="">Todos</option>
              {(meta?.sectores ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Secretaría</label>
              <select className={pdmSelect} value={filtroSecretaria} onChange={(e) => onFiltroSecretaria(e.target.value)}>
                <option value="">Todas</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">ODS</label>
            <select className={pdmSelect} value={filtroOds} onChange={(e) => onFiltroOds(e.target.value)}>
              <option value="">Todos</option>
              {(meta?.ods ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tipo acumulación</label>
            <select className={pdmSelect} value={filtroTipoAcumulacion} onChange={(e) => onFiltroTipoAcumulacion(e.target.value)}>
              <option value="">Todos</option>
              {(meta?.tipos_acumulacion ?? []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
            <select className={pdmSelect} value={filtroEstado} onChange={(e) => onFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROGRESO">En Progreso</option>
              <option value="COMPLETADO">Completado</option>
              <option value="POR_EJECUTAR">Por Ejecutar</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
              <Search size={12} /> Buscar
            </label>
            <input
              className={pdmInput}
              value={filtroBusqueda}
              onChange={(e) => onFiltroBusqueda(e.target.value)}
              placeholder="Código, nombre, línea..."
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            <strong className="text-slate-800">{productos.length}</strong> en página ·{" "}
            <strong className="text-slate-800">{totalCount}</strong> total · año <strong>{filtroAnio}</strong>
          </p>
          <button type="button" className={pdmBtnSecondary} onClick={onLimpiarFiltros}>
            <X size={14} /> Limpiar filtros
          </button>
        </div>
      </PdmCard>

      <PdmCard title={`Productos del Plan Indicativo — ${filtroAnio}`} icon={<Box size={16} />}>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Producto</th>
                  <th className="hidden px-4 py-3 text-center font-semibold text-slate-600 md:table-cell">Meta cuat.</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Meta {filtroAnio}</th>
                  <th className="hidden px-4 py-3 text-right font-semibold text-slate-600 lg:table-cell">Presupuesto</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Avance</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Estado</th>
                  <th className="hidden px-4 py-3 font-semibold text-slate-600 xl:table-cell">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No hay productos con los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  productos.map((producto) => (
                    <ProductoRow
                      key={producto.id}
                      producto={producto}
                      filtroAnio={filtroAnio}
                      isAdmin={isAdmin}
                      saving={saving}
                      secretarias={secretarias}
                      onOpenDetalle={onOpenDetalle}
                      onAsignar={onAsignar}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 border-t border-slate-100 pt-4">
            <button type="button" className={pdmBtnSecondary} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-600">
              Página {currentPage} de {totalPages}
            </span>
            <button type="button" className={pdmBtnSecondary} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </PdmCard>
    </div>
  );
}
