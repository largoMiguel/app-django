import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  Download,
  FileBarChart2,
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
  planesInformesApi,
  type GenerarInformePlanPayload,
  type InformePlan,
  type InformePlanEstado,
  TRIMESTRE_OPTIONS,
  planesApi,
  type PlanListItem,
} from "@/core/api/planes";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { formatFechaHoraCO } from "@/core/datetime";
import { primaryRole, useAuthStore } from "@/core/auth/store";
import { formatApiError } from "@/core/api/errors";
import { INFORME_PLAN_TIPO_LABEL, PLANES_INFORME_TYPES } from "@/features/planes/informes/planesInformeTypes";
import { btnPrimary, btnSecondary, inputClass } from "./components/PlanesUi";
import { usePlanesYear } from "./PlanesYearContext";

const INFORME_TIPO = "SEGUIMIENTO_D612" as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ESTADO_BADGE: Record<InformePlanEstado, { label: string; className: string }> = {
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
  onSelect: (id: (typeof PLANES_INFORME_TYPES)[number]["id"]) => void;
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
          {PLANES_INFORME_TYPES.filter((t) => t.enabled).map((tipo) => {
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

interface ReportModalProps {
  onClose: () => void;
  onSubmit: (payload: GenerarInformePlanPayload) => void;
  secretarias: Secretaria[];
  planes: PlanListItem[];
  enableAi: boolean;
  isAdmin: boolean;
  isSecretario: boolean;
  secretariaUsuarioId?: number;
  submitting: boolean;
  defaultAnio: number;
}

function ReportModal({
  onClose,
  onSubmit,
  secretarias,
  planes,
  enableAi,
  isAdmin,
  isSecretario,
  secretariaUsuarioId,
  submitting,
  defaultAnio,
}: ReportModalProps) {
  const [anio, setAnio] = useState(defaultAnio);
  const [trimestre, setTrimestre] = useState<number>(1);
  const [planId, setPlanId] = useState("");
  const [secretariaId, setSecretariaId] = useState("");
  const [firmanteId, setFirmanteId] = useState("");
  const [cargoFirmante, setCargoFirmante] = useState("");
  const [incluirEvidencias, setIncluirEvidencias] = useState(true);
  const [usarIa, setUsarIa] = useState(enableAi);
  const [tried, setTried] = useState(false);

  const firmantesSecretariaId = useMemo(() => {
    if (isSecretario && secretariaUsuarioId) return secretariaUsuarioId;
    if (isAdmin && secretariaId) return Number(secretariaId);
    return undefined;
  }, [isAdmin, isSecretario, secretariaId, secretariaUsuarioId]);

  const { data: firmantes = [], isLoading: firmantesLoading } = useQuery({
    queryKey: ["planes-informe-firmantes", firmantesSecretariaId ?? "all"],
    queryFn: () => planesInformesApi.firmantes(firmantesSecretariaId),
    enabled: true,
  });

  useEffect(() => {
    setFirmanteId("");
  }, [firmantesSecretariaId]);

  function handleGenerate() {
    setTried(true);
    if (!firmanteId || !trimestre) return;
    const payload: GenerarInformePlanPayload = {
      tipo: INFORME_TIPO,
      anio,
      trimestre,
      usuario_firmante_id: Number(firmanteId),
      incluir_evidencias: incluirEvidencias,
      usar_ia: usarIa,
    };
    if (cargoFirmante.trim()) payload.cargo_firmante = cargoFirmante.trim();
    if (isAdmin && secretariaId) payload.responsable_secretaria_id = Number(secretariaId);
    if (planId) payload.plan_id = Number(planId);
    onSubmit(payload);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between bg-[#0e7490] px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <span className="text-base font-semibold">Configurar Informe de Seguimiento D612</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Vigencia</label>
            <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Trimestre</label>
            <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className={inputClass}>
              {TRIMESTRE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dependencia (opcional)</label>
                <select value={secretariaId} onChange={(e) => setSecretariaId(e.target.value)} className={inputClass}>
                  <option value="">Toda la entidad</option>
                  {secretarias.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Plan (opcional)</label>
                <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
                  <option value="">Todos los planes</option>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-slate-700">
              <User className="h-4 w-4 text-slate-400" /> Usuario firmante
            </label>
            <select
              value={firmanteId}
              onChange={(e) => setFirmanteId(e.target.value)}
              disabled={firmantesLoading}
              className={inputClass}
            >
              <option value="">{firmantesLoading ? "Cargando usuarios…" : "Seleccionar firmante…"}</option>
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
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cargo del firmante (opcional)</label>
            <input
              type="text"
              value={cargoFirmante}
              onChange={(e) => setCargoFirmante(e.target.value)}
              placeholder="Ej. Secretaría General con funciones de Control Interno"
              className={inputClass}
            />
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
              Incluir resultados y conclusiones con IA
            </label>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className={btnSecondary}>
            <X className="mr-1.5 h-4 w-4" /> Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting || firmantesLoading}
            className={`${btnPrimary} disabled:opacity-60`}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Encolando…
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" /> Generar Informe
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanesInformesPage() {
  const user = useAuthStore((s) => s.user);
  const role = primaryRole(user);
  const isAdmin = role === "admin";
  const isSecretario = role === "secretario";
  const canView = isAdmin || isSecretario;
  const entity = user?.entity;
  const secretariaUsuarioId = user?.secretaria?.id;
  const { anio } = usePlanesYear();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: informes = [],
    isLoading: informesLoading,
    isError: informesError,
    error: informesErr,
  } = useQuery({
    queryKey: ["planes-informes", INFORME_TIPO],
    queryFn: () => planesInformesApi.list(INFORME_TIPO),
    enabled: canView,
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
    queryKey: ["secretarias", entity?.id],
    queryFn: () => secretariasApi.list(entity?.id),
    enabled: isAdmin && Boolean(entity?.id),
  });

  const { data: planesData } = useQuery({
    queryKey: ["planes-informes-planes", anio],
    queryFn: () => planesApi.list({ anio: String(anio), page_size: "100" }),
    enabled: isAdmin,
  });
  const planes = planesData?.results ?? [];

  const loading = informesLoading || (isAdmin && secretariasLoading);
  const loadError = informesError ? formatApiError(informesErr, "No se pudieron cargar los informes.") : null;

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        No tienes permiso para ver informes de Planes Institucionales.
      </div>
    );
  }

  function handleTypeSelect(id: (typeof PLANES_INFORME_TYPES)[number]["id"]) {
    setShowPicker(false);
    if (id === "SEGUIMIENTO_D612") {
      setShowReportModal(true);
      return;
    }
    if (id === "TRIMESTRAL_EXCEL") {
      navigate("/planes/informes/trimestral");
    }
  }

  async function handleDownload(informe: InformePlan) {
    if (informe.estado !== "COMPLETADO") return;
    setActionError(null);
    setDownloadingId(informe.id);
    try {
      await planesInformesApi.download(
        informe.id,
        informe.filename || `informe_seguimiento_d612_${informe.anio}_T${informe.trimestre}.pdf`,
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
      await planesInformesApi.remove(id);
      await queryClient.invalidateQueries({ queryKey: ["planes-informes", INFORME_TIPO] });
    } catch (err) {
      setActionError(formatApiError(err, "No se pudo eliminar el informe."));
    }
  }

  async function handleGenerate(payload: GenerarInformePlanPayload) {
    setActionError(null);
    setSubmitting(true);
    setShowReportModal(false);
    try {
      await planesInformesApi.create(payload);
      await queryClient.invalidateQueries({ queryKey: ["planes-informes", INFORME_TIPO] });
    } catch (err) {
      setActionError(formatApiError(err, "No se pudo encolar el informe PDF."));
    } finally {
      setSubmitting(false);
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
            <FileBarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Informes Planes Institucionales</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {informes.length} informe{informes.length !== 1 ? "s" : ""} PDF · retención 7 días
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          disabled={hasActiveJob || submitting}
          className={`${btnPrimary} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60`}
          title={hasActiveJob ? "Ya hay un informe de seguimiento en cola o generándose" : undefined}
        >
          {hasActiveJob ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generando informe…
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Crear informe
            </>
          )}
        </button>
      </div>

      {hasActiveJob && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-blue-600" />
          <div>
            <p className="font-semibold">Hay un informe de seguimiento en proceso</p>
            <p className="text-xs text-blue-700">
              La lista se actualiza automáticamente. No podrá generar otro PDF hasta que finalice.
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
          <p className="text-sm font-medium text-slate-600 sm:text-base">No hay informes PDF generados</p>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Use el botón &quot;Crear informe&quot; para generar un seguimiento D612 o exportar Excel trimestral
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
                        {informe.tipo_label || INFORME_PLAN_TIPO_LABEL.SEGUIMIENTO_D612} · Vigencia {informe.anio} ·{" "}
                        {informe.trimestre_label}
                        {informe.responsable_secretaria_nombre ? ` · ${informe.responsable_secretaria_nombre}` : ""}
                        {informe.plan_nombre ? ` · ${informe.plan_nombre}` : ""}
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
                      {informe.total_actividades > 0 && (
                        <span className="text-slate-400">
                          · {informe.total_planes} planes · {informe.total_actividades} actividades · Avance{" "}
                          {informe.avance_promedio}%
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

      {showPicker && <TypePickerModal onClose={() => setShowPicker(false)} onSelect={handleTypeSelect} />}

      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onSubmit={(p) => void handleGenerate(p)}
          secretarias={secretarias}
          planes={planes}
          enableAi={Boolean(entity?.enable_ai_reports)}
          isAdmin={isAdmin}
          isSecretario={isSecretario}
          secretariaUsuarioId={secretariaUsuarioId}
          submitting={submitting}
          defaultAnio={anio}
        />
      )}
    </div>
  );
}
