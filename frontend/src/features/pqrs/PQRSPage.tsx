import {
  Search, ChevronLeft, ChevronRight, Plus, FileText, Eye, Trash2,
  AlertTriangle, ArrowLeft, SlidersHorizontal, Users, ListFilter, Tag, RotateCcw, Info, BellRing, Clock, Mail,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import NuevaPQRSModal from "./NuevaPQRSModal";
import PQRSDetailModal from "./PQRSDetailModal";
import {
  pqrsApi,
  type PQRS,
  type EstadoPQRS,
  type TipoSolicitud,
  TIPO_SOLICITUD_LABEL,
  ESTADO_LABEL,
} from "@/core/api/pqrs";
import { secretariasApi } from "@/core/api/entities";
import { formatFechaCO } from "@/core/datetime";
import { usePqrsList, usePqrsStats, useInvalidatePqrs } from "@/core/api/hooks/usePqrs";
import { formatApiError } from "@/core/api/errors";
import { useAuthStore, canAccess, PERM } from "@/core/auth/store";
import ModuleAIAlertsBanner from "@/components/ai/ModuleAIAlertsBanner";
import PqrsAICommandBar from "@/components/ai/PqrsAICommandBar";
import PqrsAIInsights from "@/components/ai/PqrsAIInsights";
import ConfidenceBadge from "@/components/ai/ConfidenceBadge";
import { usePqrsCompliance } from "@/core/api/hooks/usePqrsAi";
const PAGE_SIZE = 15;

function tiempoRestante(p: PQRS): { text: string; cls: string } {
  if (p.estado === "cerrada" || p.estado === "respondida") return { text: "—", cls: "text-gray-400" };
  if (!p.fecha_vencimiento) return { text: "—", cls: "text-gray-400" };
  const diff = new Date(p.fecha_vencimiento).getTime() - Date.now();
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (dias < 0) return { text: "Vencida", cls: "text-red-600 font-semibold" };
  if (dias === 0) return { text: "Vence hoy", cls: "text-red-500 font-semibold" };
  if (dias <= 5) return { text: `${dias}d`, cls: "text-amber-600 font-medium" };
  return { text: `${dias}d`, cls: "text-slate-500" };
}

function pageNumbers(totalPages: number, currentPage: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "...", totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export default function PQRSPage() {
  const { user } = useAuthStore();
  const canAdmin = canAccess(user, { roles: ["admin"], permissions: [PERM.PQRS_CHANGE] });
  const navigate = useNavigate();
  const location = useLocation();
  const invalidatePqrs = useInvalidatePqrs();

  const canCreate = canAccess(user, {
    roles: ["admin", "secretario", "ciudadano"],
    permissions: [PERM.PQRS_ADD],
  });
  const canDelete = canAccess(user, {
    roles: ["admin"],
    permissions: [PERM.PQRS_DELETE],
  });
  const canVerCorreoAlerta = canAccess(user, {
    roles: ["admin", "secretario"],
    permissions: [PERM.PQRS_CHANGE],
  });
  const isAdminCorreo = canAccess(user, { roles: ["admin"], permissions: [PERM.PQRS_CHANGE] });

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchTerm = urlParams.get("q") || "";
  const filterEstado = (urlParams.get("estado") as EstadoPQRS) || "";
  const filterTipo = (urlParams.get("tipo") as TipoSolicitud) || "";
  const filterSecretaria = urlParams.get("secretaria") || "";
  const filterPendientes = urlParams.get("filtro") === "pendientes";
  const modoAlerta = urlParams.get("filtro") === "alerta";
  const currentPage = Math.max(1, Number(urlParams.get("page") || "1") || 1);
  const selectedId = urlParams.get("id") ? Number(urlParams.get("id")) : null;
  const showNuevaModal = urlParams.get("nueva") === "1";

  function updateParams(
    patch: Record<string, string | null | undefined>,
    opts?: { resetPage?: boolean },
  ) {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (opts?.resetPage !== false && !("page" in patch)) next.delete("page");
    const qs = next.toString();
    navigate({ pathname: "/pqrs", search: qs ? `?${qs}` : "" }, { replace: true });
  }

  const listParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = {
      page: currentPage,
      page_size: PAGE_SIZE,
    };
    if (searchTerm.trim()) p.search = searchTerm.trim();
    if (filterTipo) p.tipo_solicitud = filterTipo;
    if (filterSecretaria) p.assigned_to = filterSecretaria;
    if (filterPendientes) p.pendientes = true;
    else if (modoAlerta) p.alerta = true;
    else if (filterEstado) p.estado = filterEstado;
    return p;
  }, [currentPage, searchTerm, filterEstado, filterTipo, filterSecretaria, filterPendientes, modoAlerta]);

  const { data, isLoading, isError, error } = usePqrsList(listParams);
  const { data: complianceData } = usePqrsCompliance(canAdmin && !isLoading);
  const slaRisks = useMemo(() => {
    const map: Record<number, NonNullable<typeof complianceData>["sla_risks"][number]> = {};
    complianceData?.sla_risks.forEach((r) => { map[r.pqrs_id] = r; });
    return map;
  }, [complianceData]);

  const items = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: statsData } = usePqrsStats({ enabled: true });
  const alertCount = statsData?.alerta_count ?? 0;

  const { data: rechazadasData } = usePqrsList(
    { estado: "rechazada_asignacion", page: 1, page_size: 5 },
    { enabled: canAdmin && !isLoading },
  );
  const rechazadas = rechazadasData?.results ?? [];

  const { data: correoAlertaData } = usePqrsList(
    { alerta: true, page: 1, page_size: 5 },
    { enabled: canVerCorreoAlerta },
  );
  const correoAlertas = correoAlertaData?.results ?? [];

  const { data: secretarias = [] } = useQuery({
    queryKey: ["secretarias", user?.entity?.id],
    queryFn: () => secretariasApi.list(user?.entity?.id),
    enabled: canAdmin && Boolean(user?.entity?.id),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  async function handleDelete(p: PQRS) {
    if (!confirm(`¿Eliminar la PQRS ${p.numero_radicado}?`)) return;
    try {
      await pqrsApi.remove(p.id);
      invalidatePqrs();
    } catch (e) {
      alert(formatApiError(e, "No se pudo eliminar."));
    }
  }

  const loadError = isError ? formatApiError(error, "No se pudieron cargar las PQRS.") : null;

  return (
    <div className="space-y-6">
      <ModuleAIAlertsBanner
        module="pqrs"
        onAlertClick={(a) => a.object_id && navigate(`?id=${a.object_id}`)}
      />
      <PqrsAICommandBar onResultClick={(r) => navigate(`?id=${r.object_id}`)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#3eafd4]/10 text-[#3eafd4]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111827] sm:text-2xl">PQRS</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Gestión de Peticiones, Quejas, Reclamos y Sugerencias
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 rounded-[0.3rem] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <button
            onClick={() =>
              updateParams({ filtro: modoAlerta ? null : "alerta", estado: null }, { resetPage: true })
            }
            className={`flex items-center gap-1.5 rounded-[0.3rem] border px-4 py-2 text-sm font-medium transition-all ${
              modoAlerta
                ? "border-amber-500 bg-transparent text-amber-600 ring-2 ring-amber-400/50 ring-offset-1 animate-amber-glow"
                : alertCount > 0
                ? "border-amber-400 bg-transparent text-amber-700 hover:bg-amber-50"
                : "border-slate-200 bg-transparent text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className={modoAlerta || alertCount > 0 ? "animate-bounce" : ""}>
              <BellRing className="h-4 w-4" />
            </span>
            Modo Alerta
            {alertCount > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold leading-none ${
                  modoAlerta ? "animate-pulse bg-amber-500 text-white" : "bg-amber-400 text-white"
                }`}
              >
                {alertCount}
              </span>
            )}
          </button>
          {canCreate && (
            <button
              onClick={() => updateParams({ nueva: "1" }, { resetPage: false })}
              className="flex items-center gap-2 rounded-[0.3rem] bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2f9fc2]"
            >
              <Plus className="h-4 w-4" />
              Nueva PQRS
            </button>
          )}
        </div>
      </div>

      {modoAlerta && (
        <PqrsAIInsights
          title="Insights IA PQRS"
          onInsightClick={(insight) => {
            const id = insight.metadata?.pqrs_id as number | undefined;
            if (id) navigate(`?id=${id}`, { replace: false });
          }}
        />
      )}

      {showNuevaModal && (
        <NuevaPQRSModal
          onClose={() => updateParams({ nueva: null }, { resetPage: false })}
          onCreated={() => {
            updateParams({ nueva: null });
            invalidatePqrs();
          }}
        />
      )}
      {selectedId && Number.isFinite(selectedId) && (
        <PQRSDetailModal
          pqrsId={selectedId}
          onClose={() => updateParams({ id: null }, { resetPage: false })}
          onUpdated={() => invalidatePqrs()}
        />
      )}

      {canAccess(user, { roles: ["admin"], permissions: [PERM.PQRS_CHANGE] }) &&
        rechazadas.length > 0 && (
        <button
          type="button"
          onClick={() => updateParams({ id: String(rechazadas[0].id) }, { resetPage: false })}
          className="flex w-full items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-left transition-colors hover:bg-amber-100"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900">
              {rechazadas.length === 1
                ? "Hay 1 PQRS con asignación rechazada"
                : `Hay ${rechazadasData?.count ?? rechazadas.length} PQRS con asignación rechazada`}
            </div>
            <div className="text-sm text-amber-700">
              Revisa el motivo en el historial y reasigna a otra secretaría.
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {rechazadas.map((p) => (
                <span
                  key={p.id}
                  className="rounded bg-white px-1.5 py-0.5 font-mono text-[0.7rem] text-amber-800 border border-amber-200"
                >
                  {p.numero_radicado}
                </span>
              ))}
            </div>
          </div>
        </button>
      )}

      {canVerCorreoAlerta && correoAlertas.length > 0 && (
        <button
          type="button"
          onClick={() => updateParams({ id: String(correoAlertas[0].id) }, { resetPage: false })}
          className="flex w-full items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-left transition-colors hover:bg-amber-100"
        >
          <Mail className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900">
              {correoAlertas.length === 1
                ? "Hay 1 PQRS con error en el envío de correo"
                : `Hay ${correoAlertaData?.count ?? correoAlertas.length} PQRS con error en el envío de correo`}
            </div>
            <div className="text-sm text-amber-700">
              {isAdminCorreo
                ? "Corrige el destinatario y reenvía la notificación al ciudadano."
                : "Revisa el correo del ciudadano, corrígelo si es necesario y reenvía la notificación."}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {correoAlertas.map((p) => (
                <span
                  key={p.id}
                  className="rounded border border-amber-200 bg-white px-1.5 py-0.5 font-mono text-[0.7rem] text-amber-800"
                >
                  {p.numero_radicado}
                </span>
              ))}
            </div>
          </div>
        </button>
      )}

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="overflow-hidden rounded-[0.6rem] border border-[#e9ecef] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros de Búsqueda
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Search className="h-3.5 w-3.5" /> Buscar
            </label>
            <input
              type="text"
              placeholder="Radicado, ciudadano, asunto..."
              defaultValue={searchTerm}
              key={`q-${searchTerm}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateParams({ q: (e.target as HTMLInputElement).value || null });
                }
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== searchTerm) updateParams({ q: v || null });
              }}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Users className="h-3.5 w-3.5" /> Secretaría
            </label>
            <select
              value={filterSecretaria}
              onChange={(e) => updateParams({ secretaria: e.target.value || null })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700 focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            >
              <option value="">Todas</option>
              {secretarias.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <ListFilter className="h-3.5 w-3.5" /> Estado
            </label>
            <select
              value={filterEstado}
              onChange={(e) =>
                updateParams({
                  estado: e.target.value || null,
                  filtro: null,
                })
              }
              disabled={filterPendientes || modoAlerta}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700 focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Todos</option>
              {(Object.entries(ESTADO_LABEL) as [EstadoPQRS, { label: string; color: string }][]).map(
                ([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Tag className="h-3.5 w-3.5" /> Tipo
            </label>
            <select
              value={filterTipo}
              onChange={(e) => updateParams({ tipo: e.target.value || null })}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-700 focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
            >
              <option value="">Todos</option>
              {(Object.entries(TIPO_SOLICITUD_LABEL) as [TipoSolicitud, string][]).map(([key, val]) => (
                <option key={key} value={key}>
                  {val}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() =>
                updateParams({
                  q: null,
                  estado: null,
                  tipo: null,
                  secretaria: null,
                  filtro: null,
                })
              }
              className="h-10 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpiar
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <Info className="h-3.5 w-3.5" />
          {filterPendientes && "Filtro: pendientes · "}
          {modoAlerta && "Filtro: correos con error de envío · "}
          Mostrando {items.length} de {totalCount} PQRS
        </div>
      </div>

      <div className="rounded-[0.6rem] border border-[#e9ecef] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Número</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Solicitante</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Asunto</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Secretaría</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Días cal.
                  </span>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              )}
              {!isLoading && !loadError && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-12 py-12 text-center text-slate-400">
                    <FileText className="mx-auto mb-2 h-10 w-10" />
                    No hay PQRS para mostrar.
                  </td>
                </tr>
              )}
              {items.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-[0.78rem] font-medium text-slate-800">
                    <span className="inline-flex items-center gap-1.5">
                      {p.numero_radicado}
                      {p.correo_alerta && (
                        <span title="Correo con error de envío">
                          <Mail className="h-3.5 w-3.5 text-red-500" />
                        </span>
                      )}
                      {slaRisks[p.id] && slaRisks[p.id].risk_score >= 50 && (
                        <ConfidenceBadge score={slaRisks[p.id].risk_score} size="sm" label={`Riesgo ${slaRisks[p.id].risk_score}`} />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#f0fbff] px-1.5 py-0.5 text-[0.72rem] text-[#0e7490]">
                      {TIPO_SOLICITUD_LABEL[p.tipo_solicitud]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.nombre_ciudadano || "Anónimo"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="block max-w-[280px] truncate">{p.asunto}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.assigned_to_nombre || "—"}
                    {(p.assigned_secretarias?.length ?? 0) > 1 && (
                      <span
                        className="ml-1 text-xs text-slate-400"
                        title={p.assigned_secretarias?.map((s) => s.nombre).join(", ")}
                      >
                        +{(p.assigned_secretarias?.length ?? 0) - 1}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[0.72rem] font-medium ${ESTADO_LABEL[p.estado].color}`}
                    >
                      {ESTADO_LABEL[p.estado].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[0.78rem] text-slate-600">
                    {p.fecha_solicitud
                      ? formatFechaCO(p.fecha_solicitud)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[0.78rem]">
                    {(() => {
                      const t = tiempoRestante(p);
                      return <span className={t.cls}>{t.text}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => updateParams({ id: String(p.id) }, { resetPage: false })}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0e7490]"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(p)}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-[0.78rem] text-slate-500">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} de{" "}
              {totalCount}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => updateParams({ page: String(currentPage - 1) }, { resetPage: false })}
                disabled={currentPage === 1}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers(totalPages, currentPage).map((n, i) =>
                n === "..." ? (
                  <span key={`e-${i}`} className="px-1 text-[0.78rem] text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => updateParams({ page: String(n) }, { resetPage: false })}
                    className={`min-w-[28px] rounded px-1.5 py-1 text-[0.78rem] font-medium ${
                      currentPage === n ? "bg-[#3eafd4] text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                onClick={() => updateParams({ page: String(currentPage + 1) }, { resetPage: false })}
                disabled={currentPage === totalPages}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
