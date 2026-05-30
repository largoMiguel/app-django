import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileBarChart2, Plus, Download, Trash2, Calendar, Filter,
  User, AlertTriangle, X, FileText, CheckCircle2, Clock,
  ClipboardList, XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { pqrsApi, type PQRSReportPreview } from "@/core/api/pqrs";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { usersApi, type AppUser } from "@/core/api/users";
import { useAuthStore, canAccess, PERM, type AuthUser } from "@/core/auth/store";
import { formatApiError } from "@/core/api/errors";
import {
  ESTADO_LABEL,
  TIPO_SOLICITUD_LABEL,
  ROLE_LABEL,
  labelEstado,
  labelTipo,
  labelCanal,
} from "@/features/pqrs/labels";

function reportsStorageKey(user: AuthUser | null): string {
  if (!user) return "softone_pqrs_reports_guest";
  return `softone_pqrs_reports_u${user.id}_e${user.entity?.id ?? "none"}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── localStorage ───────────────────────────────────────────────────────

// ── Types ──────────────────────────────────────────────────────────────
interface ReportConfig {
  fechaInicio: string;
  fechaFin: string;
  secretariaId: string;
  secretariaNombre: string;
  estado: string;
  tipo: string;
  firmanteNombre: string;
  firmanteCargo: string;
}

interface ReportRow {
  radicado: string;
  tipo: string;
  ciudadano: string;
  estado: string;
  secretario: string;
  fechaSolicitud: string;
  fechaVencimiento: string;
  canal: string;
}

interface StoredReport {
  id: string;
  createdAt: string;
  config: ReportConfig;
  stats: { total: number; respondidas: number; cerradas: number; pendientes: number; vencidas: number };
  rows: ReportRow[];
  entityName: string;
  truncated?: boolean;
  totalRows?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────
function loadReports(key: string): StoredReport[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function saveReports(key: string, r: StoredReport[]) { localStorage.setItem(key, JSON.stringify(r)); }

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: "UTC" });
}

function generateHtml(report: StoredReport): string {
  const { config, stats, rows, entityName, createdAt } = report;

  const filterDesc = [
    config.secretariaId ? `Secretaría: ${config.secretariaNombre}` : null,
    config.estado ? `Estado: ${labelEstado(config.estado)}` : null,
    config.tipo ? `Tipo: ${labelTipo(config.tipo)}` : null,
  ].filter(Boolean).join(" · ") || "Sin filtros adicionales";

  const rowsHtml = rows.map((r, i) =>
    `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
      <td>${escapeHtml(r.radicado)}</td><td>${escapeHtml(r.ciudadano)}</td><td>${escapeHtml(r.tipo)}</td><td>${escapeHtml(r.estado)}</td>
      <td>${escapeHtml(r.secretario || "—")}</td><td>${escapeHtml(r.canal)}</td><td>${escapeHtml(r.fechaSolicitud)}</td><td>${escapeHtml(r.fechaVencimiento)}</td>
    </tr>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>Informe PQRS — ${escapeHtml(entityName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1f2937;background:#fff;padding:30px}
  .header{border-bottom:3px solid #1d4ed8;padding-bottom:14px;margin-bottom:20px}
  h1{font-size:22px;font-weight:bold;color:#1d4ed8;margin-bottom:2px}
  h2{font-size:14px;color:#374151;margin-bottom:6px;font-weight:600}
  .meta{font-size:10px;color:#6b7280;line-height:1.7}
  .stats{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .stat{background:#f1f5f9;border-radius:6px;padding:10px 16px;text-align:center;min-width:88px;border-top:3px solid}
  .stat-val{font-size:22px;font-weight:bold}.stat-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-top:2px}
  .s-total{border-color:#1d4ed8}.s-total .stat-val{color:#1d4ed8}
  .s-resp{border-color:#10b981}.s-resp .stat-val{color:#10b981}
  .s-cerr{border-color:#6b7280}.s-cerr .stat-val{color:#6b7280}
  .s-pend{border-color:#f59e0b}.s-pend .stat-val{color:#f59e0b}
  .s-venc{border-color:#ef4444}.s-venc .stat-val{color:#ef4444}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:30px}
  thead tr{background:#1d4ed8;color:white}
  thead th{padding:8px 6px;text-align:left;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.04em}
  tbody td{padding:6px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .signature{border-top:2px solid #1d4ed8;padding-top:20px;margin-top:20px}
  .sig-line{width:220px;border-top:1px solid #374151;margin:36px 0 6px 0}
  .sig-name{font-size:13px;font-weight:bold;color:#1f2937}
  .sig-cargo{font-size:11px;color:#6b7280;margin-top:2px}
  @media print{body{padding:15px}}
</style></head>
<body>
<div class="header">
  <h1>Informe de PQRS</h1><h2>${escapeHtml(entityName)}</h2>
  <div class="meta">
    <div>Período: <strong>${escapeHtml(fmtDate(config.fechaInicio))}</strong> al <strong>${escapeHtml(fmtDate(config.fechaFin))}</strong></div>
    <div>Generado: ${escapeHtml(new Date(createdAt).toLocaleString("es-CO"))}</div>
    <div>Filtros: ${escapeHtml(filterDesc)}</div>
  </div>
</div>
<div class="stats">
  <div class="stat s-total"><div class="stat-val">${stats.total}</div><div class="stat-lbl">Total</div></div>
  <div class="stat s-resp"><div class="stat-val">${stats.respondidas}</div><div class="stat-lbl">Respondidas</div></div>
  <div class="stat s-cerr"><div class="stat-val">${stats.cerradas}</div><div class="stat-lbl">Cerradas</div></div>
  <div class="stat s-pend"><div class="stat-val">${stats.pendientes}</div><div class="stat-lbl">Pendientes</div></div>
  <div class="stat s-venc"><div class="stat-val">${stats.vencidas}</div><div class="stat-lbl">Vencidas</div></div>
</div>
<table>
  <thead><tr>
    <th>Radicado</th><th>Ciudadano</th><th>Tipo</th><th>Estado</th>
    <th>Secretario</th><th>Canal</th><th>Fecha Sol.</th><th>Vencimiento</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="signature">
  <div class="sig-line"></div>
  <div class="sig-name">${escapeHtml(config.firmanteNombre)}</div>
  <div class="sig-cargo">${escapeHtml(config.firmanteCargo)}</div>
</div>
<script>window.onload=function(){window.print()};</script>
</body></html>`;
}

// ── Modal ──────────────────────────────────────────────────────────────
interface ModalProps {
  onClose: () => void;
  onGenerate: (config: ReportConfig, preview: PQRSReportPreview) => void | Promise<void>;
  users: AppUser[];
  secretarias: Secretaria[];
}

function ReportModal({ onClose, onGenerate, users, secretarias }: ModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [fechaInicio, setFechaInicio] = useState(monthAgo);
  const [fechaFin, setFechaFin] = useState(today);
  const [secretariaId, setSecretariaId] = useState("");
  const [estado, setEstado] = useState("");
  const [tipo, setTipo] = useState("");
  const [firmanteId, setFirmanteId] = useState("");
  const [tried, setTried] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const firmante = users.find((u) => String(u.id) === firmanteId);

  async function handleGenerate() {
    setTried(true);
    if (!firmanteId) return;

    setGenerating(true);
    setFetchError(null);
    try {
      const params: Record<string, string | number> = {
        fecha_desde: fechaInicio,
        fecha_hasta: fechaFin,
      };
      if (secretariaId) params.assigned_to = secretariaId;
      if (estado) params.estado = estado;
      if (tipo) params.tipo_solicitud = tipo;

      const preview = await pqrsApi.reportPreview(params);
      await onGenerate(
        {
          fechaInicio,
          fechaFin,
          secretariaId,
          secretariaNombre: secretarias.find((s) => String(s.id) === secretariaId)?.nombre || "",
          estado,
          tipo,
          firmanteNombre: firmante?.full_name || "",
          firmanteCargo: ROLE_LABEL[firmante?.role || ""] || firmante?.role || "",
        },
        preview,
      );
    } catch (err) {
      setFetchError(formatApiError(err, "No se pudieron cargar las PQRS del informe."));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fetchError}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1 text-sm font-semibold text-slate-700 mb-1.5">
                <Calendar className="h-4 w-4 text-slate-400" /> Fecha Inicial
              </label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1d4ed8] focus:outline-none" />
            </div>
            <div>
              <label className="flex items-center gap-1 text-sm font-semibold text-slate-700 mb-1.5">
                <Calendar className="h-4 w-4 text-slate-400" /> Fecha Final
              </label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#1d4ed8] focus:outline-none" />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Filter className="h-3 w-3" /> Filtros Opcionales (dejar en blanco para incluir todos)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <User className="h-3.5 w-3.5" /> Secretaría
                </label>
                <select value={secretariaId} onChange={(e) => setSecretariaId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs focus:border-[#1d4ed8] focus:outline-none">
                  <option value="">Todas las secretarías</option>
                  {secretarias.map((s) => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs focus:border-[#1d4ed8] focus:outline-none">
                  <option value="">Todos los estados</option>
                  {Object.entries(ESTADO_LABEL).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs focus:border-[#1d4ed8] focus:outline-none">
                  <option value="">Todos los tipos</option>
                  {Object.entries(TIPO_SOLICITUD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
            <label className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-slate-700">
              <User className="h-4 w-4 text-slate-400" /> Selecciona quién firma el informe
            </label>
            <select value={firmanteId} onChange={(e) => setFirmanteId(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
                tried && !firmanteId ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-[#1d4ed8]"
              }`}>
              <option value="">-- Selecciona un usuario --</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.full_name} · {ROLE_LABEL[u.role] || u.role}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[0.68rem] text-slate-400">
              ℹ El nombre y cargo seleccionado aparecerá en la sección de firma del informe PDF
            </p>
            {tried && !firmanteId && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span><strong>Requerido:</strong> Selecciona un usuario para poder generar el informe</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button onClick={onClose}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" /> Cancelar
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-md bg-[#1d4ed8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1a44c0] transition-colors disabled:opacity-60">
            <FileText className="h-4 w-4" /> {generating ? "Generando…" : "Generar Informe"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export default function PQRSInformesPage({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const entity = user?.entity;
  const storageKey = reportsStorageKey(user);

  const [showModal, setShowModal] = useState(false);
  const [reports, setReports] = useState<StoredReport[]>(() => loadReports(storageKey));

  const canAccessPage =
    canAccess(user, { roles: ["admin"], permissions: [PERM.PQRS_VIEW] }) &&
    Boolean(entity?.enable_pqrs) &&
    Boolean(entity?.enable_reports_pdf) &&
    Boolean(user?.capabilities?.reports_pdf ?? true);

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    error: usersErr,
  } = useQuery({
    queryKey: ["users", "informes", user?.entity?.id],
    queryFn: () => usersApi.list({ entity: user!.entity!.id }),
    enabled: canAccessPage && Boolean(user?.entity?.id),
  });
  const {
    data: secretarias = [],
    isLoading: secretariasLoading,
    isError: secretariasError,
    error: secretariasErr,
  } = useQuery({
    queryKey: ["secretarias", user?.entity?.id],
    queryFn: () => secretariasApi.list(user?.entity?.id),
    enabled: canAccessPage && Boolean(user?.entity?.id),
  });

  const loading = usersLoading || secretariasLoading;
  const loadError =
    usersError || secretariasError
      ? formatApiError(usersErr || secretariasErr, "No se pudieron cargar los datos para informes.")
      : null;

  useEffect(() => {
    setReports(loadReports(storageKey));
  }, [storageKey]);

  if (!canAccessPage) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 text-sm">
        No tienes permiso para generar informes.
      </div>
    );
  }

  function handleGenerate(config: ReportConfig, preview: PQRSReportPreview) {
    const now = Date.now();
    const rows: ReportRow[] = preview.rows.map((p) => ({
      radicado: p.numero_radicado,
      tipo: labelTipo(p.tipo_solicitud),
      ciudadano: p.nombre_ciudadano || p.email_ciudadano || "Anónimo",
      estado: labelEstado(p.estado),
      secretario: p.assigned_to_nombre || "",
      fechaSolicitud: fmtDate(p.fecha_solicitud),
      fechaVencimiento: fmtDate(p.fecha_vencimiento),
      canal: labelCanal(p.canal_llegada),
    }));

    const report: StoredReport = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      config,
      stats: {
        total: preview.stats.total,
        respondidas: preview.stats.respondidas,
        cerradas: preview.stats.cerradas,
        pendientes: preview.stats.pendientes,
        vencidas: preview.rows.filter(
          (p) =>
            !["respondida", "cerrada"].includes(p.estado) &&
            p.fecha_vencimiento &&
            new Date(p.fecha_vencimiento).getTime() < now,
        ).length,
      },
      rows,
      entityName: entity?.name || "Entidad",
      truncated: preview.truncated,
      totalRows: preview.total,
    };

    const updated = [report, ...reports];
    setReports(updated);
    saveReports(storageKey, updated);
    setShowModal(false);
    openReport(report);
  }

  function openReport(report: StoredReport) {
    const html = generateHtml(report);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.onload = () => URL.revokeObjectURL(url);
    else URL.revokeObjectURL(url);
  }

  function deleteReport(id: string) {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    saveReports(storageKey, updated);
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
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 flex-shrink-0">
            <FileBarChart2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#111827] sm:text-2xl truncate">Informes PQRS</h1>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {reports.length} informe{reports.length !== 1 ? "s" : ""} generado{reports.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {!onClose && (
            <Link to="/dashboard"
              className="flex items-center gap-1.5 rounded-[0.3rem] border border-slate-200 bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm text-slate-600 hover:bg-slate-50 shadow-sm whitespace-nowrap">
              ← Panel
            </Link>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-[0.3rem] bg-[#1d4ed8] px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#1a44c0] transition-colors shadow-sm whitespace-nowrap">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Crear Informe
          </button>
          {onClose && (
            <button onClick={onClose}
              className="flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Cerrar">
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 sm:py-16 px-4 text-center">
          <FileBarChart2 className="mb-2 sm:mb-3 h-10 sm:h-12 w-10 sm:w-12 text-slate-300" />
          <p className="font-medium text-slate-600 text-sm sm:text-base">No hay informes generados</p>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">Crea tu primer informe con el botón "Crear Informe"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const filterParts = [
              r.config.secretariaId ? `Secretaría: ${r.config.secretariaNombre}` : null,
              r.config.estado ? labelEstado(r.config.estado) : null,
              r.config.tipo ? labelTipo(r.config.tipo) : null,
            ].filter(Boolean);

            return (
              <div key={r.id}
                className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-slate-100 bg-white px-3 sm:px-5 py-3 sm:py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-600">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {fmtDate(r.config.fechaInicio)} — {fmtDate(r.config.fechaFin)}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-1.5 sm:px-2 py-0.5 text-[0.6rem] sm:text-[0.68rem] font-semibold text-indigo-700 whitespace-nowrap">
                        {r.stats.total} PQRS
                      </span>
                    </div>
                    <div className="mt-0.5 sm:mt-1 flex flex-wrap gap-1 sm:gap-2 text-[0.6rem] sm:text-[0.7rem] text-slate-500 truncate">
                      <span className="truncate">Generado: {new Date(r.createdAt).toLocaleString("es-CO")}</span>
                      {filterParts.length > 0 && <span className="text-slate-400 truncate">· {filterParts.slice(0, 1).join(" · ")}</span>}
                    </div>
                    <div className="mt-1 sm:mt-2 flex flex-wrap gap-1.5 sm:gap-3 text-[0.6rem] sm:text-[0.7rem]">
                      <span className="flex items-center gap-0.5 sm:gap-1 text-emerald-600 whitespace-nowrap"><CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> {r.stats.respondidas} resp.</span>
                      <span className="flex items-center gap-0.5 sm:gap-1 text-gray-500 whitespace-nowrap"><XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> {r.stats.cerradas} cerr.</span>
                      <span className="flex items-center gap-0.5 sm:gap-1 text-amber-600 whitespace-nowrap"><ClipboardList className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> {r.stats.pendientes} pend.</span>
                      {r.stats.vencidas > 0 && <span className="flex items-center gap-0.5 sm:gap-1 text-red-600 whitespace-nowrap"><Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> {r.stats.vencidas} venc.</span>}
                    </div>
                    <div className="mt-1 text-[0.6rem] sm:text-[0.68rem] text-slate-400 truncate">
                      Firma: <span className="font-medium text-slate-600">{r.config.firmanteNombre}</span>
                      {r.config.firmanteCargo && <span className="hidden sm:inline"> · {r.config.firmanteCargo}</span>}
                    </div>
                    {r.truncated && (
                      <div className="mt-1 text-[0.62rem] text-amber-700">
                        Informe truncado: mostrando {r.rows.length} de {r.totalRows} filas.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2 self-end sm:self-auto">
                  <button onClick={() => openReport(r)}
                    className="flex items-center gap-0.5 sm:gap-1.5 rounded-md bg-[#3eafd4] px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-[#2f9fc2] transition-colors whitespace-nowrap">
                    <Download className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Descargar</span><span className="sm:hidden">DL</span>
                  </button>
                  <button onClick={() => deleteReport(r.id)}
                    className="rounded-md border border-slate-200 p-1 sm:p-2 text-slate-400 hover:border-red-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Eliminar informe">
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ReportModal
          onClose={() => setShowModal(false)}
          onGenerate={handleGenerate}
          users={users}
          secretarias={secretarias}
        />
      )}
    </div>
  );
}
