import { useEffect, useMemo, useState } from "react";
import {
  X,
  Send,
  AlertTriangle,
  History,
  UserCheck,
  ThumbsDown,
  Save,
  Pencil,
  Paperclip,
  Lock,
  RotateCcw,
  Eye,
  Download,
  Mail,
  CheckCircle2,
} from "lucide-react";
import {
  pqrsApi,
  type PQRS,
  TIPO_SOLICITUD_LABEL,
  ESTADO_LABEL,
  MAX_FILE_SIZE_MB,
} from "@/core/api/pqrs";
import { openAuthenticatedFile, downloadAuthenticatedFile } from "@/core/api/client";
import { secretariasApi, type Secretaria } from "@/core/api/entities";
import { formatApiError } from "@/core/api/errors";
import { useAuthStore, primaryRole, canAccess, PERM } from "@/core/auth/store";
import EditPQRSModal from "./EditPQRSModal";

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

  const [secretariaSel, setSecretariaSel] = useState<number | "">("");
  const [justificacion, setJustificacion] = useState("");
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
  const canSecretaryAct =
    canAccess(user, { roles: ["secretario"] }) &&
    data?.assigned_to === user?.secretaria?.id;
  const canRespond =
    canAdmin ||
    (canAccess(user, { roles: ["secretario"], permissions: [PERM.PQRS_CHANGE] }) &&
      data?.assigned_to === user?.secretaria?.id);
  const estadoFinal = data?.estado === "respondida" || data?.estado === "cerrada";

  async function load() {
    setLoading(true);
    try {
      const [d, secs] = await Promise.all([
        pqrsApi.get(pqrsId),
        role !== "secretario" ? secretariasApi.list() : Promise.resolve<Secretaria[]>([]),
      ]);
      setData(d);
      setSecretarias(secs);
      setSecretariaSel(d.assigned_to ?? "");
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
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Secretaría asignada" value={data.assigned_to_nombre || "Sin asignar"} />
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

                {/* Asignar / Reasignar */}
                {canAdmin && !estadoFinal && (
                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" /> {data.assigned_to ? "Reasignar" : "Asignar"} a secretaría
                    </h3>
                    <div className="space-y-2">
                      <select
                        value={secretariaSel}
                        onChange={(e) => setSecretariaSel(Number(e.target.value))}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                      >
                        <option value="">— Selecciona —</option>
                        {secretarias.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={justificacion}
                        onChange={(e) => setJustificacion(e.target.value)}
                        rows={2}
                        placeholder="Justificación (opcional)"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
                      />
                      <button
                        disabled={!secretariaSel || busy}
                        onClick={() =>
                          handleAction(() =>
                            pqrsApi.asignar(data.id, secretariaSel as number, justificacion),
                          )
                        }
                        className="flex items-center gap-1.5 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2f9fc2] disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" /> {data.assigned_to ? "Reasignar" : "Asignar"}
                      </button>
                    </div>
                  </section>
                )}

                {/* Responder (admin o secretario asignado) */}
                {canRespond && !estadoFinal && (
                  <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800 mb-2 flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5" /> Responder PQRS
                    </h3>
                    <textarea
                      value={respuesta}
                      onChange={(e) => setRespuesta(e.target.value)}
                      rows={4}
                      placeholder="Texto de respuesta al ciudadano"
                      className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <label className="mt-2 flex items-center gap-2 text-sm text-emerald-900">
                      <Paperclip className="h-4 w-4" />
                      <span>Adjuntar documento (opcional):</span>
                      <input
                        type="file"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f && f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                            setErr(`El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`);
                            setArchivo(null);
                            e.target.value = "";
                            return;
                          }
                          setErr(null);
                          setArchivo(f);
                        }}
                        className="text-xs"
                      />
                    </label>
                    {archivo && (
                      <p className="mt-1 text-xs text-emerald-800">📎 {archivo.name}</p>
                    )}

                    {/* Opción de notificación por email */}
                    {data.email_ciudadano && (
                      <div className="mt-3 rounded-md border border-emerald-200 bg-white p-3 space-y-2">
                        <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={enviarEmail}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEnviarEmail(checked);
                              if (checked) {
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
                        {enviarEmail && emailDestino && (
                          <div className="flex items-center gap-2 rounded border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                            <span className="text-slate-500 text-xs">Para:</span>
                            <span className="flex-1 font-medium text-slate-800 truncate">{emailDestino}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEmailTemporal(emailDestino);
                                setEmailEditando(true);
                                setShowEmailConfirm(true);
                              }}
                              className="text-xs text-emerald-600 underline hover:text-emerald-800"
                            >
                              Cambiar
                            </button>
                          </div>
                        )}
                      </div>
                    )}

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

      {/* Email confirmation dialog */}
      {showEmailConfirm && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/40"
            onClick={() => {
              setShowEmailConfirm(false);
              setEmailEditando(false);
              if (!emailDestino) setEnviarEmail(false);
            }}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <Mail className="h-4 w-4 text-emerald-700" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                Confirmar correo del ciudadano
              </h3>
            </div>

            {!emailEditando ? (
              <>
                <p className="text-sm text-slate-600 mb-3">
                  La respuesta se notificará al siguiente correo electrónico:
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 break-all">
                  {emailDestino || "(sin correo registrado)"}
                </div>
                <p className="mt-3 text-xs text-slate-500">¿Es correcto este correo?</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setShowEmailConfirm(false);
                      setEmailEditando(false);
                    }}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Sí, es correcto
                  </button>
                  <button
                    onClick={() => {
                      setEmailTemporal(emailDestino);
                      setEmailEditando(true);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    No, editar correo
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEnviarEmail(false);
                    setEmailDestino("");
                    setEmailEditando(false);
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
                  Ingresa el correo electrónico correcto:
                </p>
                <input
                  type="email"
                  value={emailTemporal}
                  onChange={(e) => setEmailTemporal(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  autoFocus
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={!emailTemporal.includes("@")}
                    onClick={() => {
                      setEmailDestino(emailTemporal.trim());
                      setEmailEditando(false);
                      setShowEmailConfirm(false);
                    }}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Guardar correo
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


