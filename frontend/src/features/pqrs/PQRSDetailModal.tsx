import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Send,
  AlertTriangle,
  History,
  ThumbsDown,
  Pencil,
  Briefcase,
  Paperclip,
  Lock,
  RotateCcw,
  Eye,
  Download,
  Mail,
  CheckCircle2,
  CloudUpload,
  File as FileIcon,
  XCircle,
} from "lucide-react";
import {
  pqrsApi,
  type PQRS,
  type PQRSCorreoItem,
  TIPO_SOLICITUD_LABEL,
  ESTADO_LABEL,
  MAX_FILE_SIZE_MB,
} from "@/core/api/pqrs";
import { openAuthenticatedFile, downloadAuthenticatedFile } from "@/core/api/client";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { formatApiError } from "@/core/api/errors";
import { useAuthStore, primaryRole, canAccess, PERM } from "@/core/auth/store";
import EditPQRSModal from "./EditPQRSModal";
import PQRSAssignmentPanel from "./PQRSAssignmentPanel";

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface Props {
  pqrsId: number;
  onClose: () => void;
  onUpdated: () => void;
}

export default function PQRSDetailModal({ pqrsId, onClose, onUpdated }: Props) {
  const { user } = useAuthStore();
  const role = primaryRole(user);

  const [data, setData] = useState<PQRS | null>(null);
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"detalle" | "historial">("detalle");

  const [respuesta, setRespuesta] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  // Email notification state
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [emailEditando, setEmailEditando] = useState(false);
  const [emailTemporal, setEmailTemporal] = useState("");
  const [reenviarCorreoId, setReenviarCorreoId] = useState<number | null>(null);
  const [reenviarEmailEditado, setReenviarEmailEditado] = useState(false);
  const [showDescartarConfirm, setShowDescartarConfirm] = useState(false);
  const [dragOverArchivo, setDragOverArchivo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  async function abrirArchivo(url: string) {
    try {
      await openAuthenticatedFile(url);
    } catch {
      setErr("No se pudo abrir el archivo. Verifica tu sesión.");
    }
  }

  async function descargarArchivo(url: string, nombre: string) {
    try {
      await downloadAuthenticatedFile(url, nombre);
    } catch {
      setErr("No se pudo descargar el archivo. Verifica tu sesión.");
    }
  }

  const canAdmin = canAccess(user, { roles: ["admin"], permissions: [PERM.PQRS_CHANGE] });
  const usuarioAsignado =
    Boolean(
      user?.secretaria?.id &&
        (data?.assigned_secretarias?.some((s) => s.id === user.secretaria?.id) ||
          data?.assigned_to === user.secretaria.id),
    );
  const canSecretaryAct = canAccess(user, { roles: ["secretario"] }) && usuarioAsignado;
  const canRespond =
    canAdmin ||
    (canAccess(user, { roles: ["secretario"], permissions: [PERM.PQRS_CHANGE] }) &&
      usuarioAsignado);
  const estadoFinal = data?.estado === "respondida" || data?.estado === "cerrada";
  const puedeResponderEstado =
    data?.estado === "asignada" ||
    data?.estado === "en_proceso" ||
    (canAdmin && data?.estado === "recibida");

  function seleccionarArchivoRespuesta(file: File | null) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErr(`El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`);
      setArchivo(null);
      return;
    }
    setErr(null);
    setArchivo(file);
  }

  async function load() {
    setLoading(true);
    try {
      const [d, secs] = await Promise.all([
        pqrsApi.get(pqrsId),
        role !== "secretario" ? secretariasApi.list() : Promise.resolve<Secretaria[]>([]),
      ]);
      setData(d);
      setSecretarias(secs);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pqrsId]);

  const esAnonima = useMemo(
    () => data?.is_anonima ?? !(data?.nombre_ciudadano && data.nombre_ciudadano.trim()),
    [data],
  );

  async function handleAction(fn: () => Promise<PQRS>) {
    setBusy(true);
    setErr(null);
    try {
      const updated = await fn();
      setData(updated);
      onUpdated();
    } catch (e) {
      setErr(formatApiError(e, "Error."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#1c2536] px-6 py-3 text-white">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                {loading ? "Cargando…" : data?.numero_radicado}
                {esAnonima && !loading && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-600 px-1.5 py-0.5 text-[0.65rem] font-medium">
                    <Lock className="h-3 w-3" /> Anónima
                  </span>
                )}
              </h2>
              {data && (
                <div className="mt-0.5 flex items-center gap-2 text-xs text-white/80">
                  <span>{TIPO_SOLICITUD_LABEL[data.tipo_solicitud]}</span>
                  <span className={`rounded px-1.5 py-0.5 font-medium ${ESTADO_LABEL[data.estado].color}`}>
                    {ESTADO_LABEL[data.estado].label}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canAdmin && data && !estadoFinal && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                  title="Editar PQRS"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button onClick={onClose} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="border-b border-slate-200 px-6">
            <div className="flex gap-3">
              <TabBtn active={tab === "detalle"} onClick={() => setTab("detalle")}>
                Detalle
              </TabBtn>
              <TabBtn active={tab === "historial"} onClick={() => setTab("historial")}>
                <History className="inline h-3.5 w-3.5 mr-1" /> Historial
              </TabBtn>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading && <div className="text-slate-500">Cargando…</div>}

            {!loading && data && tab === "detalle" && (
              <div className="space-y-5">
                {/* Solicitante */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5 mb-3">
                    Solicitante
                  </h3>
                  {esAnonima ? (
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <Lock className="h-4 w-4" />
                      <span>
                        El ciudadano radicó esta PQRS de forma <strong>anónima</strong>. No se
                        registraron datos de identificación.
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Info label="Nombre" value={data.nombre_ciudadano} />
                      <Info label="Documento" value={data.cedula_ciudadano} />
                      <Info label="Email" value={data.email_ciudadano} />
                      <Info label="Teléfono" value={data.telefono_ciudadano} />
                      <Info label="Dirección" value={data.direccion_ciudadano} />
                      <Info label="Canal de respuesta" value={data.medio_respuesta} />
                    </div>
                  )}
                </section>

                {/* Solicitud */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5 mb-3">
                    Solicitud
                  </h3>
                  <>
                      <Info label="Asunto" value={data.asunto} />
                      <div className="mt-2">
                        <span className="block text-xs font-semibold text-slate-500 mb-1">Descripción</span>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.descripcion}</p>
                      </div>
                    </>
                  <div className="mt-3">
                    <span className="block text-xs font-semibold text-slate-500 mb-1.5">
                      Dependencias asignadas
                    </span>
                    {(data.assigned_secretarias?.length ?? 0) > 0 || data.assigned_to_nombre ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(data.assigned_secretarias?.length
                          ? data.assigned_secretarias.map((s) => s.nombre)
                          : data.assigned_to_nombre
                            ? [data.assigned_to_nombre]
                            : []
                        ).map((nombre) => (
                          <span
                            key={nombre}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                          >
                            <Briefcase className="h-3 w-3 text-slate-500" />
                            {nombre}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-amber-700 font-medium">Sin asignar</span>
                    )}
                  </div>
                  <div className="mt-2 text-sm">
                    <Info
                      label="Fecha de solicitud"
                      value={data.fecha_solicitud ? new Date(data.fecha_solicitud).toLocaleString("es-CO") : null}
                    />
                  </div>
                  {data.archivos && data.archivos.length > 0 && (
                    <div className="mt-3">
                      <span className="block text-xs font-semibold text-slate-500 mb-1.5">
                        Archivos adjuntos ({data.archivos.length})
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {data.archivos.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                          >
                            <Paperclip className="h-4 w-4 flex-shrink-0 text-[#3eafd4]" />
                            <span className="flex-1 truncate font-medium text-slate-800">
                              {a.nombre}
                            </span>
                            <span className="text-xs text-slate-500">{formatBytes(a.size)}</span>
                            {a.url && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => abrirArchivo(a.url!)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-[#0e7490]"
                                  title="Ver"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => descargarArchivo(a.url!, a.nombre)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-[#0e7490]"
                                  title="Descargar"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                </section>

                {/* Asignar / Reasignar */}
                {canAdmin && !estadoFinal && (
                  <PQRSAssignmentPanel
                    assignedIds={
                      data.assigned_secretarias?.map((s) => s.id) ??
                      (data.assigned_to ? [data.assigned_to] : [])
                    }
                    assignedNames={
                      data.assigned_secretarias?.length
                        ? data.assigned_secretarias.map((s) => s.nombre)
                        : data.assigned_to_nombre
                          ? [data.assigned_to_nombre]
                          : []
                    }
                    secretarias={secretarias}
                    busy={busy}
                    onSave={(ids, justificacion) =>
                      handleAction(() => pqrsApi.asignar(data.id, ids, justificacion))
                    }
                  />
                )}

                {/* Estado de correos */}
                {(data.correos?.length ?? 0) > 0 && (() => {
                  const correos = data.correos || [];
                  const correosCiudadano = correos.filter(
                    (c) => c.tipo === "radicacion" || c.tipo === "respuesta",
                  );
                  const correosAsignacion = correos.filter((c) => c.tipo === "asignacion");
                  const latestPorEmail = latestEstadoPorEmail(correosCiudadano);
                  const alertaActiva =
                    data.correo_alerta ?? tieneCorreoAlertaActiva(latestPorEmail);
                  const correoReenvio = alertaActiva
                    ? correoParaReenviar(correosCiudadano, latestPorEmail)
                    : null;
                  const mensajeExito = mensajeEstadoCorreo(latestPorEmail);
                  const tieneCorreosCiudadano = correosCiudadano.length > 0;
                  const abrirReenvio = (correo: PQRSCorreoItem) => {
                    const destinos = destinatariosFallidosActivos(correo, latestPorEmail)
                      .map((d) => d.email)
                      .filter(Boolean)
                      .join(", ");
                    setReenviarCorreoId(correo.id);
                    setEmailDestino(destinos);
                    setEmailTemporal(destinos);
                    setReenviarEmailEditado(false);
                    setEmailEditando(false);
                    setShowEmailConfirm(true);
                  };
                  return (
                    <section
                      className={`rounded-lg border p-4 ${
                        !tieneCorreosCiudadano
                          ? "border-slate-200 bg-slate-50"
                          : alertaActiva
                            ? "border-red-300 bg-red-50"
                            : "border-emerald-200 bg-emerald-50"
                      }`}
                    >
                      <h3
                        className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${
                          !tieneCorreosCiudadano
                            ? "text-slate-700"
                            : alertaActiva
                              ? "text-red-800"
                              : "text-emerald-800"
                        }`}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Estado del correo
                        {tieneCorreosCiudadano && alertaActiva && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white normal-case">
                            <AlertTriangle className="h-3 w-3" /> Requiere atención
                          </span>
                        )}
                        {tieneCorreosCiudadano && !alertaActiva && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white normal-case">
                            <CheckCircle2 className="h-3 w-3" /> Enviado correctamente
                          </span>
                        )}
                      </h3>
                      {tieneCorreosCiudadano && !alertaActiva && (
                        <p className="mb-3 text-sm text-emerald-800">{mensajeExito}</p>
                      )}
                      {tieneCorreosCiudadano && alertaActiva && (canRespond || canAdmin) && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {correoReenvio && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => abrirReenvio(correoReenvio)}
                              className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Corregir y reenviar
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setShowDescartarConfirm(true)}
                            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <X className="h-3.5 w-3.5" />
                            No enviar más por correo
                          </button>
                        </div>
                      )}
                      <div className="space-y-3">
                        {correosCiudadano.map((c) => (
                          <CorreoEstadoCard
                            key={c.id}
                            correo={c}
                            latestPorEmail={latestPorEmail}
                            modoHistorial={!alertaActiva}
                          />
                        ))}
                        {correosAsignacion.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Notificaciones de asignación
                            </p>
                            <div className="space-y-2">
                              {correosAsignacion.map((c) => (
                                <CorreoEstadoCard
                                  key={c.id}
                                  correo={c}
                                  latestPorEmail={latestEstadoPorEmail(correosAsignacion)}
                                  modoHistorial
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })()}

                {/* Respuesta existente */}
                {data.respuesta && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5 mb-3">
                      Respuesta
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.respuesta}</p>
                    {data.archivo_respuesta_url && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => abrirArchivo(data.archivo_respuesta_url!)}
                          className="inline-flex items-center gap-1.5 text-sm text-[#0e7490] hover:underline"
                        >
                          <Eye className="h-4 w-4" /> Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => descargarArchivo(data.archivo_respuesta_url!, "respuesta")}
                          className="inline-flex items-center gap-1.5 text-sm text-[#0e7490] hover:underline"
                        >
                          <Download className="h-4 w-4" /> Descargar
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* Responder (admin o secretario asignado) */}
                {canRespond && !estadoFinal && puedeResponderEstado && (
                  <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800 mb-2 flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5" /> Responder PQRS
                    </h3>
                    {canAdmin && data.estado === "recibida" && !data.assigned_to && (
                      <p className="mb-2 text-xs text-emerald-800">
                        Esta PQRS no está asignada. Como administrador, puedes responder directamente.
                      </p>
                    )}
                    <textarea
                      value={respuesta}
                      onChange={(e) => setRespuesta(e.target.value)}
                      rows={4}
                      placeholder="Texto de respuesta al ciudadano"
                      className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="mt-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-900">
                        <Paperclip className="h-3.5 w-3.5" />
                        Adjuntar documento (opcional)
                      </p>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverArchivo(true);
                        }}
                        onDragLeave={() => setDragOverArchivo(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverArchivo(false);
                          seleccionarArchivoRespuesta(e.dataTransfer.files?.[0] || null);
                        }}
                        onClick={() => archivoRef.current?.click()}
                        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center transition-all ${
                          dragOverArchivo
                            ? "border-emerald-400 bg-emerald-100/60"
                            : "border-emerald-200 bg-white hover:border-emerald-300"
                        }`}
                      >
                        <CloudUpload className="mx-auto mb-1 h-6 w-6 text-emerald-400" />
                        <div className="text-sm text-emerald-800">Arrastra un archivo aquí</div>
                        <div className="text-xs text-emerald-600">o</div>
                        <span className="mt-1 inline-block text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline">
                          Seleccionar archivo
                        </span>
                        <p className="mt-1 text-[0.7rem] text-emerald-600">
                          Máximo {MAX_FILE_SIZE_MB} MB
                        </p>
                        <input
                          ref={archivoRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            seleccionarArchivoRespuesta(e.target.files?.[0] || null);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {archivo && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm">
                          <FileIcon className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                          <span className="flex-1 truncate text-emerald-900">{archivo.name}</span>
                          <span className="text-xs text-emerald-600">{formatBytes(archivo.size)}</span>
                          <button
                            type="button"
                            onClick={() => setArchivo(null)}
                            className="text-emerald-500 hover:text-red-500"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Opción de notificación por email */}
                    <div className="mt-3 rounded-md border border-emerald-200 bg-white p-3 space-y-2">
                      <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={enviarEmail}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEnviarEmail(checked);
                            if (checked) {
                              setReenviarCorreoId(null);
                              setEmailDestino(data.email_ciudadano ?? "");
                              setEmailEditando(false);
                              setShowEmailConfirm(true);
                            }
                          }}
                          className="h-4 w-4 rounded accent-emerald-600"
                        />
                        <Mail className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-emerald-900">
                          Notificar al ciudadano por email
                        </span>
                      </label>
                      {enviarEmail && (
                        <p className="text-xs text-emerald-800">
                          Puede indicar varios correos separados por coma.
                        </p>
                      )}
                      {enviarEmail && emailDestino && (
                        <div className="flex items-center gap-2 rounded border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                          <span className="text-slate-500 text-xs">Para:</span>
                          <span className="flex-1 font-medium text-slate-800 break-all">{emailDestino}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setReenviarCorreoId(null);
                              setEmailTemporal(emailDestino);
                              setEmailEditando(true);
                              setShowEmailConfirm(true);
                            }}
                            className="text-xs text-emerald-600 underline hover:text-emerald-800 shrink-0"
                          >
                            Cambiar
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      disabled={!respuesta.trim() || busy}
                      onClick={() =>
                        handleAction(() =>
                          pqrsApi.responder(data.id, respuesta, archivo, {
                            enviarEmail,
                            emailDestino: enviarEmail ? emailDestino : undefined,
                          }),
                        )
                      }
                      className="mt-2 flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" /> Enviar respuesta
                    </button>
                  </section>
                )}

                {/* Rechazar asignación (solo secretario asignado) */}
                {canSecretaryAct && !estadoFinal && (
                  <section className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-red-700 mb-2 flex items-center gap-1.5">
                      <ThumbsDown className="h-3.5 w-3.5" /> Rechazar asignación
                    </h3>
                    <p className="text-xs text-red-700 mb-2 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      Indica el motivo. El admin verá tu negación y podrá reasignar.
                    </p>
                    <textarea
                      value={motivoRechazo}
                      onChange={(e) => setMotivoRechazo(e.target.value)}
                      rows={3}
                      placeholder="Motivo del rechazo"
                      className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <button
                      disabled={!motivoRechazo.trim() || busy}
                      onClick={() =>
                        handleAction(() => pqrsApi.rechazarAsignacion(data.id, motivoRechazo))
                      }
                      className="mt-2 flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <ThumbsDown className="h-4 w-4" /> Rechazar asignación
                    </button>
                  </section>
                )}

                {canAdmin && data.estado === "respondida" && (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={busy}
                      onClick={() => handleAction(() => pqrsApi.reabrir(data.id))}
                      className="flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                    >
                      <RotateCcw className="h-4 w-4" /> Reabrir PQRS
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => handleAction(() => pqrsApi.cerrar(data.id))}
                      className="flex items-center gap-1.5 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Cerrar PQRS
                    </button>
                  </div>
                )}

                {err && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {err}
                  </div>
                )}
              </div>
            )}

            {!loading && data && tab === "historial" && (
              <div className="space-y-3">
                {(data.auditoria || []).length === 0 && (
                  <div className="text-sm text-slate-500">Sin movimientos.</div>
                )}
                {(data.auditoria || []).map((a) => {
                  const nombre =
                    a.usuario_anterior_nombre ||
                    a.usuario_nuevo_nombre ||
                    a.usuario_anterior_email ||
                    a.usuario_nuevo_email ||
                    "—";
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {a.accion === "rechazo" && (
                            <ThumbsDown className="h-3.5 w-3.5 text-red-600" />
                          )}
                          {a.accion === "edicion" && (
                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          )}
                          {a.accion === "asignacion" && "Asignación"}
                          {a.accion === "reasignacion" && "Reasignación"}
                          {a.accion === "rechazo" && "Rechazo de asignación"}
                          {a.accion === "respuesta" && "Respuesta"}
                          {a.accion === "reapertura" && "Reapertura"}
                          {a.accion === "edicion" && "Edición de datos"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {a.fecha_asignacion
                            ? new Date(a.fecha_asignacion).toLocaleString("es-CO")
                            : ""}
                        </span>
                      </div>
                      {(a.secretaria_anterior_nombre || a.secretaria_nueva_nombre) && (
                        <div className="mt-1 text-xs text-slate-600">
                          {a.secretaria_anterior_nombre && (
                            <>
                              De <strong>{a.secretaria_anterior_nombre}</strong>{" "}
                            </>
                          )}
                          {a.secretaria_nueva_nombre && (
                            <>
                              → <strong>{a.secretaria_nueva_nombre}</strong>
                            </>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-slate-500">por {nombre}</div>
                      {a.justificacion && (
                        <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-700 whitespace-pre-wrap">
                          {a.justificacion}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {editOpen && data && (
        <EditPQRSModal
          pqrs={data}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setData(updated);
            setEditOpen(false);
            onUpdated();
          }}
        />
      )}

      {/* Email confirmation / reenvío dialog */}
      {showEmailConfirm && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/40"
            onClick={() => {
              setShowEmailConfirm(false);
              setEmailEditando(false);
              setReenviarCorreoId(null);
              setReenviarEmailEditado(false);
              if (!emailDestino) setEnviarEmail(false);
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <Mail className="h-4 w-4 text-emerald-700" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                {reenviarCorreoId
                  ? "Corregir y reenviar correo"
                  : "Confirmar correo del ciudadano"}
              </h3>
            </div>

            {!emailEditando ? (
              <>
                <p className="text-sm text-slate-600 mb-3">
                  {reenviarCorreoId
                    ? "Se reenviará solo a los correos que fallaron:"
                    : "La respuesta se notificará a:"}
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 break-all">
                  {emailDestino || emailTemporal || "(sin correo registrado)"}
                </div>
                {reenviarCorreoId && (
                  <p className="mt-2 text-xs text-slate-500">
                    Los destinatarios que ya recibieron el correo no se volverán a notificar.
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  {reenviarCorreoId ? "¿Desea reenviar a estos destinatarios?" : "¿Es correcto?"}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      if (reenviarCorreoId && data) {
                        handleAction(() =>
                          pqrsApi.reenviarCorreo(data.id, {
                            correoId: reenviarCorreoId,
                            ...(reenviarEmailEditado && {
                              emailDestino: emailDestino || emailTemporal,
                            }),
                          }),
                        ).then(() => {
                          setShowEmailConfirm(false);
                          setReenviarCorreoId(null);
                          setReenviarEmailEditado(false);
                        });
                      } else {
                        setShowEmailConfirm(false);
                        setEmailEditando(false);
                      }
                    }}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    {reenviarCorreoId ? "Reenviar" : "Sí, es correcto"}
                  </button>
                  <button
                    onClick={() => {
                      setEmailTemporal(emailDestino || emailTemporal);
                      setEmailEditando(true);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {reenviarCorreoId ? "Cambiar destinatarios" : "No, editar correo"}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEnviarEmail(false);
                    setEmailDestino("");
                    setEmailEditando(false);
                    setReenviarCorreoId(null);
                    setReenviarEmailEditado(false);
                    setShowEmailConfirm(false);
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-3">
                  Ingrese uno o varios correos separados por coma:
                </p>
                <input
                  type="text"
                  value={emailTemporal}
                  onChange={(e) => setEmailTemporal(e.target.value)}
                  placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={!emailTemporal.split(/[,;]/).some((e) => e.trim().includes("@"))}
                    onClick={() => {
                      const trimmed = emailTemporal.trim();
                      if (reenviarCorreoId && data) {
                        setEmailDestino(trimmed);
                        setReenviarEmailEditado(true);
                        handleAction(() =>
                          pqrsApi.reenviarCorreo(data.id, {
                            correoId: reenviarCorreoId,
                            emailDestino: trimmed,
                          }),
                        ).then(() => {
                          setShowEmailConfirm(false);
                          setReenviarCorreoId(null);
                          setReenviarEmailEditado(false);
                          setEmailEditando(false);
                        });
                      } else {
                        setEmailDestino(trimmed);
                        setEmailEditando(false);
                        setShowEmailConfirm(false);
                      }
                    }}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {reenviarCorreoId ? "Reenviar" : "Guardar correo"}
                  </button>
                  <button
                    onClick={() => setEmailEditando(false)}
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showDescartarConfirm && data && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/40"
            onClick={() => setShowDescartarConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                Descartar alerta de correo
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Si el correo es incorrecto y no se conoce un destinatario válido, puedes quitar la
              alerta. No se enviará más notificación a los correos con error.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Los destinatarios con fallo dejarán de generar alertas en el listado.
            </div>
            <div className="mt-4 flex gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  handleAction(() => pqrsApi.descartarAlertaCorreo(data.id)).then(() => {
                    setShowDescartarConfirm(false);
                  })
                }
                className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Sí, descartar alerta
              </button>
              <button
                onClick={() => setShowDescartarConfirm(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-2 py-2.5 text-sm transition-colors ${
        active
          ? "border-[#3eafd4] text-[#0e7490] font-semibold"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-sm text-slate-800">{value || "—"}</span>
    </div>
  );
}

const CORREO_ESTADO_LABEL: Record<string, { label: string; color: string; alert?: boolean }> = {
  pendiente: { label: "Pendiente", color: "bg-slate-100 text-slate-700" },
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-800" },
  entregado: { label: "Entregado", color: "bg-emerald-100 text-emerald-800" },
  sustituido: { label: "Corregido", color: "bg-sky-100 text-sky-800" },
  descartado: { label: "Descartado", color: "bg-slate-100 text-slate-600" },
  rebote_temporal: { label: "Devolución temporal", color: "bg-amber-100 text-amber-900", alert: true },
  rebotado: { label: "Devolución permanente", color: "bg-orange-100 text-orange-900", alert: true },
  reclamacion_spam: { label: "Marcado como spam", color: "bg-purple-100 text-purple-900", alert: true },
  error: { label: "Error de envío", color: "bg-red-100 text-red-800", alert: true },
};

const TIPO_CORREO_LABEL: Record<string, string> = {
  radicacion: "Radicación",
  respuesta: "Respuesta",
  asignacion: "Asignación",
};

function estadoCorreoBadge(estado: string) {
  const cfg = CORREO_ESTADO_LABEL[estado] || CORREO_ESTADO_LABEL.pendiente;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
  );
}

const ESTADOS_ALERTA = new Set([
  "error",
  "rebotado",
  "rebote_temporal",
  "reclamacion_spam",
]);

function esEstadoAlerta(estado: string) {
  return ESTADOS_ALERTA.has(estado);
}

const CORREOS_CIUDADANO = new Set(["radicacion", "respuesta"]);

function latestEstadoPorEmail(correos: PQRSCorreoItem[]): Record<string, string> {
  const latest: Record<string, string> = {};
  const sorted = [...correos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const c of sorted) {
    for (const d of c.destinatarios || []) {
      if (d.email && d.estado) latest[d.email.toLowerCase()] = d.estado;
    }
  }
  return latest;
}

function tieneCorreoAlertaActiva(latestPorEmail: Record<string, string>) {
  return Object.values(latestPorEmail).some(esEstadoAlerta);
}

function mensajeEstadoCorreo(latestPorEmail: Record<string, string>) {
  const valores = Object.values(latestPorEmail);
  const hayDescartado = valores.some((e) => e === "descartado");
  const haySustituido = valores.some((e) => e === "sustituido");
  const hayEntregado = valores.some((e) => e === "enviado" || e === "entregado");

  if (hayDescartado && !hayEntregado) {
    return "Se descartó la notificación por correo a destinatarios inválidos.";
  }
  if (hayDescartado && hayEntregado) {
    return "La notificación se envió a los destinatarios válidos. Los correos inválidos fueron descartados.";
  }
  if (haySustituido) {
    return "La notificación se reenvió correctamente tras corregir el destinatario.";
  }
  return "La notificación fue entregada a todos los destinatarios.";
}

function destinatariosFallidosActivos(
  correo: PQRSCorreoItem,
  latestPorEmail: Record<string, string>,
) {
  return (correo.destinatarios || []).filter(
    (d) => d.email && esEstadoAlerta(latestPorEmail[d.email.toLowerCase()] || ""),
  );
}

function correoParaReenviar(
  correos: PQRSCorreoItem[],
  latestPorEmail: Record<string, string>,
): PQRSCorreoItem | null {
  const activos = new Set(
    Object.entries(latestPorEmail)
      .filter(([, est]) => esEstadoAlerta(est))
      .map(([email]) => email),
  );
  if (activos.size === 0) return null;
  const sorted = [...correos]
    .filter((c) => CORREOS_CIUDADANO.has(c.tipo))
    .sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return (
    sorted.find((c) =>
      (c.destinatarios || []).some((d) => activos.has(d.email.toLowerCase())),
    ) ?? null
  );
}

function CorreoEstadoCard({
  correo,
  latestPorEmail,
  modoHistorial,
}: {
  correo: PQRSCorreoItem;
  latestPorEmail: Record<string, string>;
  modoHistorial: boolean;
}) {
  const fallosActivos = destinatariosFallidosActivos(correo, latestPorEmail);
  const alerta = !modoHistorial && fallosActivos.length > 0;
  return (
    <div
      className={`rounded-md border p-3 text-sm ${
        alerta ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-800">
            {TIPO_CORREO_LABEL[correo.tipo] || correo.tipo}
          </span>
          {modoHistorial ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Historial
            </span>
          ) : (
            estadoCorreoBadge(correo.estado)
          )}
        </div>
        <span className="text-xs text-slate-500">
          {new Date(correo.created_at).toLocaleString("es-CO")}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600 truncate" title={correo.asunto}>
        {correo.asunto}
      </p>
      {(correo.destinatarios || []).length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {correo.destinatarios.map((d) => {
            const estadoActual = latestPorEmail[d.email.toLowerCase()] || d.estado;
            const destAlerta = !modoHistorial && esEstadoAlerta(estadoActual);
            return (
              <li
                key={d.email}
                className={`rounded px-2 py-1.5 text-xs ${
                  destAlerta ? "border border-red-200 bg-white" : "bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-700 break-all">{d.email}</span>
                  {estadoCorreoBadge(estadoActual)}
                </div>
                {d.motivo && (destAlerta || estadoActual === "sustituido" || estadoActual === "descartado") && (
                  <p
                    className={`mt-1 break-all whitespace-pre-wrap ${
                      destAlerta ? "text-red-700" : "text-slate-600"
                    }`}
                  >
                    {d.motivo}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {correo.error && !correo.destinatarios?.some((d) => d.motivo) && alerta && (
        <p className="mt-2 text-xs text-red-600 break-all">{correo.error}</p>
      )}
    </div>
  );
}


