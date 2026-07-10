import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileBarChart2,
  Plus,
  Download,
  Trash2,
  Calendar,
  Filter,
  User,
  AlertTriangle,
  X,
  FileText,
  Sparkles,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { informesApi, type GenerarInformePayload, type InformePQRS } from "@/core/api/pqrs";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { formatFechaCO, formatFechaHoraCO } from "@/core/datetime";
import { usersApi, type AppUser } from "@/core/api/users";
import { useAuthStore, canAccess, PERM } from "@/core/auth/store";
import { formatApiError } from "@/core/api/errors";
import { ESTADO_LABEL, TIPO_SOLICITUD_LABEL, ROLE_LABEL } from "@/features/pqrs/labels";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatFechaCO(iso);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ModalProps {
  onClose: () => void;
  onGenerated: (informe: InformePQRS) => void;
  users: AppUser[];
  secretarias: Secretaria[];
  enableAi: boolean;
}

function ReportModal({ onClose, onGenerated, users, secretarias, enableAi }: ModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [fechaInicio, setFechaInicio] = useState(monthAgo);
  const [fechaFin, setFechaFin] = useState(today);
  const [secretariaId, setSecretariaId] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [firmanteId, setFirmanteId] = useState("");
  const [usarIa, setUsarIa] = useState(enableAi);
  const [tried, setTried] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleGenerate() {
    setTried(true);
    if (!firmanteId) return;

    setGenerating(true);
    setFetchError(null);
    try {
      const payload: GenerarInformePayload = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        usar_ia: usarIa,
        usuario_firmante_id: Number(firmanteId),
      };
      if (secretariaId) payload.assigned_to = Number(secretariaId);
      if (estado) payload.estado = estado;
      if (tipo) payload.tipo_solicitud = tipo;

      const informe = await informesApi.generate(payload);
      onGenerated(informe);
    } catch (err) {
      setFetchError(formatApiError(err, "No se pudo generar el informe PDF."));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-[#1d4ed8] px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <span className="font-semibold text-base">Configurar Informe de PQRS</span>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/20 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {fetchError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fetchError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1 text-sm font-semibold text-slate-700 mb-1.5">
                <Calendar className="h-4 w-4 text-slate-400" /> Fecha Inicial
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1d4ed8] focus:outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-sm font-semibold text-slate-700 mb-1.5">
                <Calendar className="h-4 w-4 text-slate-400" /> Fecha Final
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1d4ed8] focus:outline-none"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Filter className="h-3 w-3" /> Filtros opcionales
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <User className="h-3.5 w-3.5" /> Secretaría
                </label>
                <select
                  value={secretariaId}
                  onChange={(e) => setSecretariaId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs focus:border-[#1d4ed8] focus:outline-none"
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
                <label className="mb-1 block text-xs font-semibold text-slate-600">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs focus:border-[#1d4ed8] focus:outline-none"
                >
                  <option value="">Todos</option>
                  {Object.entries(ESTADO_LABEL).map(([v, { label }]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs focus:border-[#1d4ed8] focus:outline-none"
                >
                  <option value="">Todos</option>
                  {Object.entries(TIPO_SOLICITUD_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-red-600">✍ Firma del Informe</span>
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">
                Obligatorio
              </span>
            </div>
            <select
              value={firmanteId}
              onChange={(e) => setFirmanteId(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                tried && !firmanteId
                  ? "border-red-400 focus:border-red-500"
                  : "border-slate-300 focus:border-[#1d4ed8]"
              }`}
            >
              <option value="">-- Selecciona un usuario --</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.full_name} · {ROLE_LABEL[u.role] || u.role}
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

          {enableAi && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={usarIa}
                onChange={(e) => setUsarIa(e.target.checked)}
                className="h-4 w-4 accent-[#1d4ed8]"
              />
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Incluir análisis con IA
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-md bg-[#1d4ed8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a44c0] transition-colors disabled:opacity-60"
          >
            <FileText className="h-4 w-4" /> {generating ? "Generando PDF…" : "Generar Informe"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PQRSInformesPage({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const entity = user?.entity;
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const canAccessPage =
    canAccess(user, { roles: ["admin"], permissions: [PERM.PQRS_VIEW] }) &&
    Boolean(entity?.enable_pqrs) &&
    Boolean(entity?.enable_reports_pdf) &&
    Boolean(user?.capabilities?.reports_pdf ?? true);

  const {
    data: informes = [],
    isLoading: informesLoading,
    isError: informesError,
    error: informesErr,
  } = useQuery({
    queryKey: ["pqrs-informes", user?.entity?.id],
    queryFn: () => informesApi.list(),
    enabled: canAccessPage,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users", "informes", user?.entity?.id],
    queryFn: () => usersApi.list({ entity: user!.entity!.id }),
    enabled: canAccessPage && Boolean(user?.entity?.id),
  });

  const { data: secretarias = [], isLoading: secretariasLoading } = useQuery({
    queryKey: ["secretarias", user?.entity?.id],
    queryFn: () => secretariasApi.list(user?.entity?.id),
    enabled: canAccessPage && Boolean(user?.entity?.id),
  });

  const loading = informesLoading || usersLoading || secretariasLoading;
  const loadError = informesError
    ? formatApiError(informesErr, "No se pudieron cargar los informes.")
    : null;

  if (!canAccessPage) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm">
        No tienes permiso para generar informes.
      </div>
    );
  }

  async function handleDownload(informe: InformePQRS) {
    setActionError(null);
    setDownloadingId(informe.id);
    try {
      await informesApi.download(informe.id, informe.filename);
    } catch (err) {
      setActionError(formatApiError(err, "No se pudo descargar el informe."));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(id: number) {
    setActionError(null);
    try {
      await informesApi.remove(id);
      await queryClient.invalidateQueries({ queryKey: ["pqrs-informes"] });
    } catch (err) {
      setActionError(formatApiError(err, "No se pudo eliminar el informe."));
    }
  }

  function handleGenerated(informe: InformePQRS) {
    setShowModal(false);
    queryClient.invalidateQueries({ queryKey: ["pqrs-informes"] });
    void handleDownload(informe);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm animate-pulse">
        Cargando…
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
      <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 flex-shrink-0">
            <FileBarChart2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#111827] sm:text-2xl truncate">
              Informes PQRS
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {informes.length} informe{informes.length !== 1 ? "s" : ""} disponible
              {informes.length !== 1 ? "s" : ""} · expiran en 7 días
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {!onClose && (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-[0.3rem] border border-slate-200 bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm text-slate-600 hover:bg-slate-50 shadow-sm whitespace-nowrap"
            >
              ← Panel
            </Link>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-[0.3rem] bg-[#1d4ed8] px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#1a44c0] transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Crear Informe
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Cerrar"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {informes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 sm:py-16 px-4 text-center">
          <FileBarChart2 className="mb-2 sm:mb-3 h-10 sm:h-12 w-10 sm:w-12 text-slate-300" />
          <p className="font-medium text-slate-600 text-sm sm:text-base">No hay informes generados</p>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Crea tu primer informe institucional en PDF con el botón &quot;Crear Informe&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {informes.map((informe) => (
            <div
              key={informe.id}
              className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-slate-100 bg-white px-3 sm:px-5 py-3 sm:py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-600">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                      {fmtDate(informe.fecha_inicio)} — {fmtDate(informe.fecha_fin)}
                    </span>
                    <span className="rounded-full bg-indigo-100 px-1.5 sm:px-2 py-0.5 text-[0.6rem] sm:text-[0.68rem] font-semibold text-indigo-700 whitespace-nowrap">
                      {informe.total_pqrs} PQRS
                    </span>
                    {informe.used_ai && (
                      <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-violet-700">
                        IA
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 sm:mt-1 flex flex-wrap gap-1 sm:gap-2 text-[0.6rem] sm:text-[0.7rem] text-slate-500">
                    <span>Generado: {formatFechaHoraCO(informe.created_at)}</span>
                    <span className="text-slate-400">· {formatFileSize(informe.file_size)}</span>
                    <span className="text-slate-400">
                      · Tasa resolución: {informe.tasa_resolucion}%
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.62rem] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expira en {informe.expires_in_days} día
                      {informe.expires_in_days !== 1 ? "s" : ""}
                    </span>
                    {informe.created_by_nombre && (
                      <span>· Por {informe.created_by_nombre}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2 self-end sm:self-auto">
                <button
                  onClick={() => handleDownload(informe)}
                  disabled={downloadingId === informe.id}
                  className="flex items-center gap-0.5 sm:gap-1.5 rounded-md bg-[#3eafd4] px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-[#2f9fc2] transition-colors whitespace-nowrap disabled:opacity-60"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  {downloadingId === informe.id ? "Descargando…" : "Descargar"}
                </button>
                <button
                  onClick={() => handleDelete(informe.id)}
                  className="rounded-md border border-slate-200 p-1 sm:p-2 text-slate-400 hover:border-red-300 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Eliminar informe"
                >
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ReportModal
          onClose={() => setShowModal(false)}
          onGenerated={handleGenerated}
          users={users}
          secretarias={secretarias}
          enableAi={Boolean(entity?.enable_ai_reports)}
        />
      )}
    </div>
  );
}
