import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  pdmApi,
  pdmInformesApi,
  type GenerarInformePdmPayload,
  type InformePDM,
  type InformePdmEstado,
} from "@/core/api/pdm";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { formatFechaHoraCO } from "@/core/datetime";
import { useAuthStore } from "@/core/auth/store";
import { formatApiError } from "@/core/api/errors";
import { usePdm } from "@/features/pdm/PdmContext";
import { ANIOS_PDM } from "@/features/pdm/pdmUtils";
import { pdmBtnPrimary } from "@/features/pdm/pdmStyles";
import {
  INFORME_PDM_TIPO_LABEL,
  PDM_INFORME_TYPES,
  type PdmInformePickerTipo,
} from "@/features/pdm/informes/pdmInformeTypes";

const INFORME_TIPO = "AVANCE" as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ESTADO_BADGE: Record<InformePdmEstado, { label: string; className: string }> = {
  PENDIENTE: { label: "En cola", className: "bg-amber-100 text-amber-800" },
  PROCESANDO: { label: "Generando", className: "bg-blue-100 text-blue-800" },
  COMPLETADO: { label: "Completado", className: "bg-emerald-100 text-emerald-800" },
  ERROR: { label: "Error", className: "bg-red-100 text-red-800" },
};

function TypePickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (id: PdmInformePickerTipo) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#0e7490] px-6 py-4 text-white">
          <span className="text-base font-semibold">Seleccionar tipo de informe</span>
          <button type="button" onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          {PDM_INFORME_TYPES.filter((t) => t.enabled).map((tipo) => {
            const Icon = tipo.icon;
            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => onSelect(tipo.id)}
                className="flex w-full items-start gap-4 rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-[#3eafd4] hover:bg-cyan-50/50"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{tipo.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{tipo.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ModalProps {
  slug: string;
  onClose: () => void;
  onSubmit: (payload: GenerarInformePdmPayload) => void;
  secretarias: Secretaria[];
  enableAi: boolean;
  isAdmin: boolean;
  isSecretario: boolean;
  secretariaUsuarioId?: number;
  submitting: boolean;
  defaultAnio: number;
}

function ReportModal({
  slug,
  onClose,
  onSubmit,
  secretarias,
  enableAi,
  isAdmin,
  isSecretario,
  secretariaUsuarioId,
  submitting,
  defaultAnio,
}: ModalProps) {
  const [anio, setAnio] = useState(defaultAnio);
  const [secretariaId, setSecretariaId] = useState("");
  const [firmanteId, setFirmanteId] = useState("");
  const [incluirEvidencias, setIncluirEvidencias] = useState(true);
  const [usarIa, setUsarIa] = useState(enableAi);
  const [tried, setTried] = useState(false);

  const firmantesSecretariaId = useMemo(() => {
    if (isSecretario && secretariaUsuarioId) return secretariaUsuarioId;
    if (isAdmin && secretariaId) return Number(secretariaId);
    return undefined;
  }, [isAdmin, isSecretario, secretariaId, secretariaUsuarioId]);

  const { data: firmantes = [], isLoading: firmantesLoading } = useQuery({
    queryKey: ["pdm-informe-firmantes", slug, firmantesSecretariaId ?? "all"],
    queryFn: () => pdmInformesApi.firmantes(slug, firmantesSecretariaId),
    enabled: Boolean(slug),
  });

  useEffect(() => {
    setFirmanteId("");
  }, [firmantesSecretariaId]);

  function handleGenerate() {
    setTried(true);
    if (!firmanteId) return;
    const payload: GenerarInformePdmPayload = {
      tipo: INFORME_TIPO,
      anio,
      usuario_firmante_id: Number(firmanteId),
      incluir_evidencias: incluirEvidencias,
      usar_ia: usarIa,
    };
    if (isAdmin && secretariaId) {
      payload.responsable_secretaria_id = Number(secretariaId);
    }
    onSubmit(payload);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#0e7490] px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <span className="text-base font-semibold">Configurar Informe de Avance de PDM</span>
          </div>
          <button onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Vigencia</label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#0e7490] focus:outline-none"
            >
              {ANIOS_PDM.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dependencia (opcional)</label>
              <select
                value={secretariaId}
                onChange={(e) => setSecretariaId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#0e7490] focus:outline-none"
              >
                <option value="">Toda la entidad</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-slate-700">
              <User className="h-4 w-4 text-slate-400" /> Usuario firmante
              {firmantesSecretariaId ? " (dependencia seleccionada)" : ""}
            </label>
            <select
              value={firmanteId}
              onChange={(e) => setFirmanteId(e.target.value)}
              disabled={firmantesLoading}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#0e7490] focus:outline-none disabled:bg-slate-50"
            >
              <option value="">
                {firmantesLoading ? "Cargando usuarios…" : "Seleccionar firmante…"}
              </option>
              {firmantes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
            {tried && !firmanteId && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span>
                  <strong>Requerido:</strong> Selecciona un usuario firmante
                </span>
              </div>
            )}
            {!firmantesLoading && firmantes.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                No hay usuarios activos{firmantesSecretariaId ? " en esta dependencia" : ""}.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={incluirEvidencias}
              onChange={(e) => setIncluirEvidencias(e.target.checked)}
              className="h-4 w-4 accent-[#0e7490]"
            />
            Incluir evidencias fotográficas
          </label>

          {enableAi && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={usarIa}
                onChange={(e) => setUsarIa(e.target.checked)}
                className="h-4 w-4 accent-[#0e7490]"
              />
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Incluir conclusiones con IA
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={submitting || firmantesLoading}
            className="flex items-center gap-2 rounded-md bg-[#0e7490] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0c6178] disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Encolando…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" /> Generar Informe
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PlanAccionModalProps {
  slug: string;
  onClose: () => void;
  secretarias: Secretaria[];
  isAdmin: boolean;
  defaultAnio: number;
}

function PlanAccionModal({ slug, onClose, secretarias, isAdmin, defaultAnio }: PlanAccionModalProps) {
  const [anio, setAnio] = useState(defaultAnio);
  const [secretariaId, setSecretariaId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!slug) return;
    setDownloading(true);
    setError(null);
    const params: Record<string, string> = { anio: String(anio) };
    if (isAdmin && secretariaId) {
      params.responsable_secretaria = secretariaId;
    }
    const depSuffix = secretariaId ? `_dep${secretariaId}` : "";
    const filename = `Plan_Accion_PDM_${slug}_${anio}${depSuffix}.xlsx`;
    try {
      await pdmApi.downloadPlanAccion(slug, params, filename);
      onClose();
    } catch (err) {
      setError(formatApiError(err, "No se pudo generar el Excel del plan de acción."));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#0e7490] px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            <span className="text-base font-semibold">Configurar Plan de Acción (Excel)</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-sm text-slate-600">
            Exporte actividades, metas, responsables y resúmenes por producto y dependencia. La descarga es inmediata
            y no se guarda historial en el servidor.
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Vigencia</label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#0e7490] focus:outline-none"
            >
              {ANIOS_PDM.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dependencia (opcional)</label>
              <select
                value={secretariaId}
                onChange={(e) => setSecretariaId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#0e7490] focus:outline-none"
              >
                <option value="">Toda la entidad</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloading}
            className="flex items-center gap-2 rounded-md bg-[#0e7490] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0c6178] disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generando…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Descargar Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PdmInformesPage() {
  const { slug, isAdmin, isSecretario, filtroAnio, entityId, secretariaUsuarioId } = usePdm();
  const entity = useAuthStore((s) => s.user?.entity);
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPlanAccionModal, setShowPlanAccionModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canView = isAdmin || isSecretario;

  const {
    data: informes = [],
    isLoading: informesLoading,
    isError: informesError,
    error: informesErr,
  } = useQuery({
    queryKey: ["pdm-informes", slug, INFORME_TIPO],
    queryFn: () => pdmInformesApi.list(slug, INFORME_TIPO),
    enabled: canView && Boolean(slug),
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      const pending = rows.some((i) => i.estado === "PENDIENTE" || i.estado === "PROCESANDO");
      return pending ? 5000 : false;
    },
  });

  const hasActiveJob = useMemo(
    () => informes.some((i) => i.estado === "PENDIENTE" || i.estado === "PROCESANDO"),
    [informes],
  );

  const { data: secretarias = [], isLoading: secretariasLoading } = useQuery({
    queryKey: ["secretarias", entityId],
    queryFn: () => secretariasApi.list(entityId),
    enabled: isAdmin && Boolean(entityId),
  });

  const loading = informesLoading || (isAdmin && secretariasLoading);
  const loadError = informesError
    ? formatApiError(informesErr, "No se pudieron cargar los informes.")
    : null;

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        No tienes permiso para ver informes PDM.
      </div>
    );
  }

  async function handleDownload(informe: InformePDM) {
    if (informe.estado !== "COMPLETADO") return;
    setActionError(null);
    setDownloadingId(informe.id);
    try {
      await pdmInformesApi.download(
        slug,
        informe.id,
        informe.filename || `informe_avance_pdm_${informe.anio}.pdf`,
      );
    } catch (err) {
      setActionError(formatApiError(err, "No se pudo descargar el informe."));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(id: number) {
    setActionError(null);
    try {
      await pdmInformesApi.remove(slug, id);
      await queryClient.invalidateQueries({ queryKey: ["pdm-informes", slug, INFORME_TIPO] });
    } catch (err) {
      setActionError(formatApiError(err, "No se pudo eliminar el informe."));
    }
  }

  async function handleGenerate(payload: GenerarInformePdmPayload) {
    setActionError(null);
    setSubmitting(true);
    setShowReportModal(false);
    try {
      await pdmInformesApi.create(slug, payload);
      await queryClient.invalidateQueries({ queryKey: ["pdm-informes", slug, INFORME_TIPO] });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setActionError(
        status === 409
          ? "Ya hay un informe de este tipo en cola o en proceso. Espere a que termine."
          : formatApiError(err, "No se pudo encolar el informe PDF."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleTypeSelect(id: PdmInformePickerTipo) {
    setShowPicker(false);
    if (id === "AVANCE") {
      setShowReportModal(true);
      return;
    }
    if (id === "PLAN_ACCION") {
      setShowPlanAccionModal(true);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 animate-pulse items-center justify-center text-sm text-slate-500">
        Cargando informes…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-slate-600">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <FileBarChart2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[#111827] sm:text-xl">Informes PDM</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {informes.length} informe{informes.length !== 1 ? "s" : ""} · retención 7 días
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          disabled={hasActiveJob || submitting}
          className={`${pdmBtnPrimary} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60`}
          title={hasActiveJob ? "Ya hay un informe en cola o generándose" : undefined}
        >
          {hasActiveJob ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generando informe…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Crear informe
            </>
          )}
        </button>
      </div>

      {hasActiveJob && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-blue-600" />
          <div>
            <p className="font-semibold">Hay un informe en proceso</p>
            <p className="text-xs text-blue-700">
              La lista se actualiza automáticamente. No podrá generar otro hasta que finalice.
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}

      {informes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center sm:py-16">
          <FileText className="mb-2 h-10 w-10 text-slate-300 sm:mb-3 sm:h-12 sm:w-12" />
          <p className="text-sm font-medium text-slate-600 sm:text-base">No hay informes generados</p>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Cree su primer informe con el botón &quot;Crear informe&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {informes.map((informe) => {
            const badge = ESTADO_BADGE[informe.estado];
            return (
              <div
                key={informe.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4"
              >
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 sm:h-10 sm:w-10 sm:rounded-xl">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
                        {informe.tipo_label || INFORME_PDM_TIPO_LABEL.AVANCE} · Vigencia {informe.anio}
                        {informe.responsable_secretaria_nombre
                          ? ` · ${informe.responsable_secretaria_nombre}`
                          : ""}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold sm:px-2 sm:text-[0.68rem] ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {informe.usar_ia && (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-violet-700">
                          IA
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-[0.6rem] text-slate-500 sm:mt-1 sm:gap-2 sm:text-[0.7rem]">
                      <span>Generado: {formatFechaHoraCO(informe.created_at)}</span>
                      {informe.file_size > 0 && (
                        <span className="text-slate-400">· {formatFileSize(informe.file_size)}</span>
                      )}
                      {informe.total_productos > 0 && (
                        <span className="text-slate-400">
                          · {informe.total_productos} productos · Avance {informe.avance_fisico}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.62rem] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expira en {informe.expires_in_days} día
                        {informe.expires_in_days !== 1 ? "s" : ""}
                      </span>
                      {informe.created_by_nombre && <span>· Por {informe.created_by_nombre}</span>}
                    </div>
                    {informe.estado === "ERROR" && informe.error_detail && (
                      <p className="mt-1 text-xs text-red-600">{informe.error_detail}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 self-end sm:gap-2 sm:self-auto">
                  <button
                    type="button"
                    onClick={() => void handleDownload(informe)}
                    disabled={informe.estado !== "COMPLETADO" || downloadingId === informe.id}
                    className="flex items-center gap-0.5 rounded-md bg-[#3eafd4] px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#2f9fc2] disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                    {downloadingId === informe.id ? "Descargando…" : "Descargar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(informe.id)}
                    className="flex-shrink-0 rounded-md border border-slate-200 p-1 text-slate-400 transition-colors hover:border-red-300 hover:text-red-500 sm:p-2"
                    title="Eliminar informe"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPicker && (
        <TypePickerModal
          onClose={() => setShowPicker(false)}
          onSelect={handleTypeSelect}
        />
      )}

      {showReportModal && (
        <ReportModal
          slug={slug}
          onClose={() => setShowReportModal(false)}
          onSubmit={(p) => void handleGenerate(p)}
          secretarias={secretarias}
          enableAi={Boolean(entity?.enable_ai_reports)}
          isAdmin={isAdmin}
          isSecretario={isSecretario}
          secretariaUsuarioId={secretariaUsuarioId}
          submitting={submitting}
          defaultAnio={filtroAnio}
        />
      )}

      {showPlanAccionModal && (
        <PlanAccionModal
          slug={slug}
          onClose={() => setShowPlanAccionModal(false)}
          secretarias={secretarias}
          isAdmin={isAdmin}
          defaultAnio={filtroAnio}
        />
      )}
    </div>
  );
}
