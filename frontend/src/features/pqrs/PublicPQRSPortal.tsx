import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  AlignLeft,
  Building,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  FileIcon,
  FrownIcon,
  Globe,
  Info,
  Lightbulb,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { publicPqrsApi, type EntityPublicInfo, type PQRSPublicResult } from "@/core/api/pqrsPublic";
import { formatFechaCO } from "@/core/datetime";
import { TIPO_SOLICITUD_LABEL } from "@/features/pqrs/labels";
import { MAX_ARCHIVOS_PQRS, MAX_FILE_SIZE_MB } from "@/core/api/pqrs";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "auto" | "manual";

const TIPOS = [
  { value: "peticion", label: TIPO_SOLICITUD_LABEL.peticion, icon: Send },
  { value: "queja", label: TIPO_SOLICITUD_LABEL.queja, icon: FrownIcon },
  { value: "reclamo", label: TIPO_SOLICITUD_LABEL.reclamo, icon: AlertCircle },
  { value: "sugerencia", label: TIPO_SOLICITUD_LABEL.sugerencia, icon: Lightbulb },
  { value: "denuncia", label: TIPO_SOLICITUD_LABEL.denuncia, icon: AlertCircle },
  { value: "solicitud_informacion", label: TIPO_SOLICITUD_LABEL.solicitud_informacion, icon: Info },
  { value: "copia", label: TIPO_SOLICITUD_LABEL.copia, icon: FileIcon },
  { value: "otro", label: TIPO_SOLICITUD_LABEL.otro, icon: AlignLeft },
] as const;

const CANALES_RESPUESTA = [
  { value: "email", label: "Correo electrónico" },
  { value: "telefono", label: "Teléfono" },
  { value: "fisica", label: "Física / Carta" },
  { value: "presencial", label: "Presencial" },
  { value: "otro", label: "Otro" },
];

const TIPO_DOC = [
  { value: "CC", label: "Cédula de Ciudadanía" },
  { value: "TI", label: "Tarjeta de Identidad" },
  { value: "CE", label: "Cédula de Extranjería" },
  { value: "NIT", label: "NIT" },
  { value: "PP", label: "Pasaporte" },
  { value: "OTRO", label: "Otro" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PublicPQRSPortal() {
  const { slug } = useParams<{ slug: string }>();
  const [entity, setEntity] = useState<EntityPublicInfo | null>(null);
  const [loadingEntity, setLoadingEntity] = useState(true);
  const [entityError, setEntityError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("manual");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PQRSPublicResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto mode fields
  const [texto, setTexto] = useState("");
  const [autoFiles, setAutoFiles] = useState<File[]>([]);
  const [autoHabeas, setAutoHabeas] = useState(false);

  // Manual mode fields
  const [tipo, setTipo] = useState("peticion");
  const [anonimo, setAnonimo] = useState(false);
  const [tipoPersona, setTipoPersona] = useState<"natural" | "juridica">("natural");
  const [tipoDoc, setTipoDoc] = useState("CC");
  const [documento, setDocumento] = useState("");
  const [nombres, setNombres] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [canalRespuesta, setCanalRespuesta] = useState("email");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [manualHabeas, setManualHabeas] = useState(false);
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});
  const [autoFileWarning, setAutoFileWarning] = useState<string | null>(null);
  const [manualFileWarning, setManualFileWarning] = useState<string | null>(null);

  const autoFileRef = useRef<HTMLInputElement>(null);
  const manualFileRef = useRef<HTMLInputElement>(null);

  const aiEnabled = Boolean(entity?.enable_ai_reports);

  useEffect(() => {
    if (!aiEnabled && mode === "auto") setMode("manual");
  }, [aiEnabled, mode]);

  useEffect(() => {
    if (!slug) return;
    publicPqrsApi
      .getEntity(slug)
      .then(setEntity)
      .catch(() => setEntityError("No encontramos la entidad. Verifica el enlace."))
      .finally(() => setLoadingEntity(false));
  }, [slug]);

  // ─── File helpers ──────────────────────────────────────────────────

  function addFiles(
    existing: File[],
    incoming: FileList | null,
  ): { files: File[]; warning: string | null } {
    if (!incoming) return { files: existing, warning: null };
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    const valid: File[] = [];
    let skippedOversized = 0;
    for (const f of Array.from(incoming)) {
      if (f.size > maxBytes) {
        skippedOversized += 1;
        continue;
      }
      valid.push(f);
    }
    const merged = [...existing, ...valid].slice(0, MAX_ARCHIVOS_PQRS);
    const warning =
      skippedOversized > 0
        ? `${skippedOversized} archivo(s) no se agregaron porque superan ${MAX_FILE_SIZE_MB} MB.`
        : null;
    return { files: merged, warning };
  }

  function removeFile(list: File[], idx: number): File[] {
    return list.filter((_, i) => i !== idx);
  }

  // ─── Submit handlers ───────────────────────────────────────────────

  async function submitAuto(e: React.FormEvent) {
    e.preventDefault();
    if (!entity) return;
    if (!autoHabeas) {
      setSubmitError("Debes aceptar el tratamiento de datos personales.");
      return;
    }
    if (!texto.trim() && autoFiles.length === 0) {
      setSubmitError("Escribe tu solicitud o adjunta al menos un documento.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("texto", texto);
      autoFiles.forEach((f) => fd.append("archivos", f));
      const res = await publicPqrsApi.createAuto(entity.slug, fd);
      setResult(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Ocurrió un error al radicar la solicitud.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!entity) return;
    const errors: Record<string, string> = {};
    if (!asunto.trim()) errors.asunto = "El asunto es obligatorio.";
    if (descripcion.trim().length < 30) errors.descripcion = "Describe con al menos 30 caracteres.";
    if (!anonimo) {
      if (!nombres.trim()) errors.nombres = "El nombre es obligatorio.";
      if (canalRespuesta === "email" && !email.trim().includes("@"))
        errors.email = "Ingresa un correo electrónico válido.";
    }
    if (!manualHabeas) errors.habeas = "Debes aceptar el tratamiento de datos personales.";
    if (Object.keys(errors).length > 0) {
      setManualErrors(errors);
      return;
    }
    setManualErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("tipo_solicitud", tipo);
      fd.append("anonimo", anonimo ? "true" : "false");
      fd.append("asunto", asunto);
      fd.append("descripcion", descripcion);
      fd.append("medio_respuesta", canalRespuesta);
      if (!anonimo) {
        fd.append("tipo_persona", tipoPersona);
        fd.append("tipo_identificacion", tipoDoc);
        if (documento) fd.append("cedula_ciudadano", documento);
        if (nombres) fd.append("nombre_ciudadano", nombres);
        if (email) fd.append("email_ciudadano", email);
        if (telefono) fd.append("telefono_ciudadano", telefono);
        if (direccion) fd.append("direccion_ciudadano", direccion);
      }
      manualFiles.forEach((f) => fd.append("archivos", f));
      const res = await publicPqrsApi.createManual(entity.slug, fd);
      setResult(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Ocurrió un error al radicar la solicitud.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render: Loading / Error ───────────────────────────────────────

  if (loadingEntity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (entityError || !entity) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Entidad no encontrada</h1>
        <p className="text-slate-500">{entityError}</p>
      </div>
    );
  }

  if (!entity.enable_pqrs) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-amber-400 mb-4" />
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Portal no disponible</h1>
        <p className="text-slate-500">
          El módulo PQRS no está habilitado para {entity.name}.
        </p>
      </div>
    );
  }

  // ─── Render: Success ───────────────────────────────────────────────

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">¡Solicitud radicada!</h1>
          <p className="text-slate-500 mb-6">
            Tu {result.tipo_solicitud === "peticion" ? "petición" : "solicitud"} fue recibida
            correctamente por <strong>{result.entity_name}</strong>.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 mb-6">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider mb-1">
              Número de radicado
            </p>
            <p className="text-2xl font-bold text-emerald-700">{result.numero_radicado}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-left mb-6">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Tipo</p>
              <p className="font-medium text-slate-700 capitalize">{result.tipo_solicitud.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Estado</p>
              <p className="font-medium text-slate-700 capitalize">{result.estado}</p>
            </div>
            {result.fecha_solicitud && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Fecha de radicado</p>
                <p className="font-medium text-slate-700">
                  {formatFechaCO(result.fecha_solicitud)}
                </p>
              </div>
            )}
            {result.fecha_vencimiento && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Fecha límite de respuesta</p>
                <p className="font-medium text-slate-700">
                  {formatFechaCO(result.fecha_vencimiento)}
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Guarda tu número de radicado para hacer seguimiento a tu solicitud.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: Form ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          {entity.logo_url && (
            <img src={entity.logo_url} alt={entity.name} className="h-10 w-10 rounded-lg object-contain" />
          )}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Portal ciudadano</p>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">{entity.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Radicación de PQRS</h2>
          <p className="text-slate-500 text-sm">
            Radica tu Petición, Queja, Reclamo, Sugerencia u otro tipo de solicitud de forma rápida
            y segura.
          </p>
          {entity.horario_atencion && (
            <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Horario: {entity.horario_atencion}
            </p>
          )}
        </div>

        {/* Mode switcher (solo si IA habilitada para la entidad) */}
        {aiEnabled && (
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              mode === "manual"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Globe className="h-4 w-4" />
            Formulario manual
          </button>
          <button
            onClick={() => setMode("auto")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              mode === "auto"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            Modo automático (IA)
          </button>
        </div>
        )}

        {/* ─── AUTO MODE ──────────────────────────────────────────── */}
        {aiEnabled && mode === "auto" && (
          <form onSubmit={submitAuto} className="space-y-5">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700">
              <p className="font-medium mb-1">¿Cómo funciona?</p>
              <p className="text-xs text-purple-600">
                Escribe tu solicitud con tus propias palabras o adjunta documentos, y nuestra IA
                completará el formulario automáticamente, identificando el tipo de solicitud y
                extrayendo tus datos.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Describe tu solicitud
              </label>
              <textarea
                rows={6}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe aquí con detalle tu petición, queja, reclamo, sugerencia... Incluye fechas, personas involucradas, y cualquier dato que consideres relevante."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
              />
            </div>

            {/* Files */}
            <FileUploadArea
              files={autoFiles}
              inputRef={autoFileRef}
              warning={autoFileWarning}
              onAdd={(fl) => {
                const { files, warning } = addFiles(autoFiles, fl);
                setAutoFiles(files);
                setAutoFileWarning(warning);
              }}
              onRemove={(i) => setAutoFiles(removeFile(autoFiles, i))}
            />

            {/* Habeas data */}
            <HabeasDataCheck checked={autoHabeas} onChange={setAutoHabeas} />

            {submitError && <ErrorBox msg={submitError} />}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {submitting ? "Procesando con IA..." : "Radicar con IA"}
            </button>
          </form>
        )}

        {/* ─── MANUAL MODE ────────────────────────────────────────── */}
        {mode === "manual" && (
          <form onSubmit={submitManual} className="space-y-5">
            {/* Tipo de solicitud */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de solicitud
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIPOS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipo(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                      tipo === value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Anónimo toggle */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Solicitud anónima</p>
                <p className="text-xs text-slate-400">
                  No se registrará tu nombre ni documento
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnonimo(!anonimo)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  anonimo ? "bg-emerald-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    anonimo ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Datos del ciudadano */}
            {!anonimo && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">Datos del solicitante</p>

                {/* Tipo persona */}
                <div className="flex gap-2">
                  {(["natural", "juridica"] as const).map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setTipoPersona(tp)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
                        tipoPersona === tp
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tp === "natural" ? "Persona Natural" : "Persona Jurídica"}
                    </button>
                  ))}
                </div>

                {/* Documento */}
                <div className="flex gap-2">
                  <div className="w-36">
                    <SelectField
                      value={tipoDoc}
                      onChange={setTipoDoc}
                      options={TIPO_DOC}
                      label="Tipo doc."
                    />
                  </div>
                  <div className="flex-1">
                    <InputField
                      label="Número de documento"
                      value={documento}
                      onChange={setDocumento}
                      placeholder="1234567890"
                    />
                  </div>
                </div>

                {/* Nombre */}
                <InputField
                  label="Nombre completo *"
                  value={nombres}
                  onChange={setNombres}
                  placeholder="Tu nombre completo"
                  error={manualErrors.nombres}
                  icon={<Building className="h-4 w-4 text-slate-400" />}
                />

                {/* Contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Correo electrónico"
                    value={email}
                    onChange={setEmail}
                    placeholder="correo@ejemplo.com"
                    error={manualErrors.email}
                    icon={<Mail className="h-4 w-4 text-slate-400" />}
                    type="email"
                  />
                  <InputField
                    label="Teléfono"
                    value={telefono}
                    onChange={setTelefono}
                    placeholder="310 000 0000"
                    icon={<Phone className="h-4 w-4 text-slate-400" />}
                  />
                </div>

                <InputField
                  label="Dirección"
                  value={direccion}
                  onChange={setDireccion}
                  placeholder="Calle 1 # 2-3, Ciudad"
                  icon={<MapPin className="h-4 w-4 text-slate-400" />}
                />
              </div>
            )}

            {/* Canal de respuesta */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                ¿Cómo deseas recibir la respuesta?
              </label>
              <SelectField
                value={canalRespuesta}
                onChange={setCanalRespuesta}
                options={CANALES_RESPUESTA}
                label=""
              />
            </div>

            {/* Asunto */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Asunto *
              </label>
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Resumen breve de tu solicitud"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                  manualErrors.asunto
                    ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                    : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-400"
                }`}
              />
              {manualErrors.asunto && (
                <p className="mt-1 text-xs text-red-500">{manualErrors.asunto}</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Descripción detallada *
              </label>
              <textarea
                rows={5}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe con detalle tu solicitud, los hechos, fechas y cualquier información relevante."
                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-1 resize-none ${
                  manualErrors.descripcion
                    ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                    : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-400"
                }`}
              />
              <div className="mt-1 flex justify-between">
                {manualErrors.descripcion ? (
                  <p className="text-xs text-red-500">{manualErrors.descripcion}</p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-slate-400">{descripcion.length} caracteres</p>
              </div>
            </div>

            {/* Files */}
            <FileUploadArea
              files={manualFiles}
              inputRef={manualFileRef}
              warning={manualFileWarning}
              onAdd={(fl) => {
                const { files, warning } = addFiles(manualFiles, fl);
                setManualFiles(files);
                setManualFileWarning(warning);
              }}
              onRemove={(i) => setManualFiles(removeFile(manualFiles, i))}
            />

            {/* Habeas data */}
            <HabeasDataCheck
              checked={manualHabeas}
              onChange={setManualHabeas}
              error={manualErrors.habeas}
            />

            {submitError && <ErrorBox msg={submitError} />}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {submitting ? "Radicando..." : "Radicar solicitud"}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            Portal ciudadano · Powered by SoftOne360
          </p>
          {entity.phone && (
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
              <Phone className="h-3 w-3" />
              {entity.phone}
            </p>
          )}
          {entity.email && (
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
              <Mail className="h-3 w-3" />
              {entity.email}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FileUploadArea({
  files,
  inputRef,
  warning,
  onAdd,
  onRemove,
}: {
  files: File[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  warning?: string | null;
  onAdd: (fl: FileList) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Documentos adjuntos (opcional)
      </label>
      {warning && (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warning}
        </p>
      )}
      <div
        className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-center cursor-pointer hover:border-slate-300 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onAdd(e.dataTransfer.files);
        }}
      >
        <CloudUpload className="h-7 w-7 text-slate-300 mx-auto mb-1" />
        <p className="text-sm text-slate-500">
          Arrastra archivos aquí o{" "}
          <span className="text-emerald-600 font-medium">haz clic para seleccionar</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Máx. {MAX_ARCHIVOS_PQRS} archivos · {MAX_FILE_SIZE_MB} MB c/u
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onAdd(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <FileIcon className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="flex-1 truncate text-slate-700">{f.name}</span>
              <span className="text-xs text-slate-400">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-slate-400 hover:text-red-500"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HabeasDataCheck({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-xs text-slate-600 leading-relaxed">
          Autorizo el tratamiento de mis datos personales de acuerdo con la{" "}
          <strong>Ley 1581 de 2012</strong> (Habeas Data). Los datos suministrados serán usados
          exclusivamente para tramitar esta solicitud y dar respuesta oportuna según la{" "}
          <strong>Ley 1755 de 2015</strong>.
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  error,
  icon,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  icon?: React.ReactNode;
  type?: string;
}) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border py-2 text-sm focus:outline-none focus:ring-1 ${
            icon ? "pl-9 pr-3" : "px-3"
          } ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-400"
              : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-400"
          }`}
        />
      </div>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-200 px-3 py-2 pr-8 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
}
