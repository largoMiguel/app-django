import {
  X,
  Sparkles,
  LayoutGrid,
  FileText,
  FrownIcon,
  AlertOctagon,
  Lightbulb,
  ShieldAlert,
  Smile,
  Info,
  Copy,
  AlertCircle,
  CloudUpload,
  FileIcon,
  XCircle,
  CreditCard,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Bookmark,
  AlignLeft,
  Send,
  CalendarDays,
  Inbox,
  Package,
  Users,
  Globe,
  Briefcase,
} from "lucide-react";
import { useForm } from "react-hook-form";import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useEffect, useMemo } from "react";
import { formatApiError } from "@/core/api/errors";
import { useAuthStore } from "@/core/auth/store";
import { isModuleEnabled, isUserModuleEnabled } from "@/core/auth/modules";
import { TIPO_SOLICITUD_LABEL } from "@/features/pqrs/labels";
import {
  pqrsApi,
  type TipoSolicitud,
  type CreatePQRSPayload,
  MAX_ARCHIVOS_PQRS,
  MAX_FILE_SIZE_MB,
  filterValidUploadFiles,
} from "@/core/api/pqrs";

// ─── Schemas ─────────────────────────────────────────────────────────
const autoSchema = z.object({
  texto: z.string().optional(),
  habeasData: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el tratamiento de datos para continuar." }),
  }),
});

const manualSchema = z.object({
  tipo: z.string().min(1, "Selecciona el tipo de trámite."),
  canalLlegada: z.string().min(1, "Selecciona el canal por el que llegó la solicitud."),
  tipoSolicitante: z.enum(["natural", "juridica"]),
  anonimo: z.boolean(),
  tipoDoc: z.string().optional(),
  documento: z.string().optional(),
  nombres: z.string().optional(),
  apellidos: z.string().optional(),
  email: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  asunto: z.string().min(1, "El asunto es obligatorio."),
  descripcion: z.string().min(30, "Describe con al menos 30 caracteres."),
  canalRespuesta: z.string().optional(),
  fechaSolicitud: z.string().optional(),
  habeasData: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el tratamiento de datos para continuar." }),
  }),
}).superRefine((data, ctx) => {
  if (!data.anonimo) {
    const isJuridica = data.tipoSolicitante === "juridica";
    const docPattern = isJuridica ? /^[\d\-]{5,20}$/ : /^\d{5,15}$/;
    if (!data.documento || !docPattern.test(data.documento)) {
      ctx.addIssue({ code: "custom", path: ["documento"], message: isJuridica ? "NIT inválido (solo números y guión, ej. 900123456-7)." : "Documento inválido (solo números, 5-15 dígitos)." });
    }
    if (!data.nombres || data.nombres.trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["nombres"], message: isJuridica ? "Ingresa la razón social." : "Ingresa tus nombres." });
    }
    if (!isJuridica && (!data.apellidos || data.apellidos.trim().length === 0)) {
      ctx.addIssue({ code: "custom", path: ["apellidos"], message: "Ingresa tus apellidos." });
    }
    // Email es obligatorio SOLO si el canal es "email"
    if (data.canalRespuesta === "email" || !data.canalRespuesta) {
      if (!data.email || !data.email.trim()) {
        ctx.addIssue({ code: "custom", path: ["email"], message: "El correo electrónico es obligatorio." });
      } else {
        const _emails = data.email.split(/[;,]/).map((e) => e.trim()).filter(Boolean);
        const _re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const em of _emails) {
          if (!_re.test(em)) {
            ctx.addIssue({ code: "custom", path: ["email"], message: `"${em}" no es un correo válido.` });
            break;
          }
        }
      }
    }
    // Teléfono es obligatorio si el canal es "telefono"
    if (data.canalRespuesta === "telefono") {
      if (!data.telefono || data.telefono.trim().length === 0) {
        ctx.addIssue({ code: "custom", path: ["telefono"], message: "Teléfono inválido." });
      }
    }
  }
});

type AutoForm = z.infer<typeof autoSchema>;
type ManualForm = z.infer<typeof manualSchema>;

// ─── Tipos de trámite ─────────────────────────────────────────────────
const TIPOS = (Object.keys(TIPO_SOLICITUD_LABEL) as TipoSolicitud[]).map((value) => ({
  value,
  label: TIPO_SOLICITUD_LABEL[value],
  Icon: {
    peticion: FileText,
    queja: FrownIcon,
    reclamo: AlertOctagon,
    sugerencia: Lightbulb,
    denuncia: ShieldAlert,
    felicitacion: Smile,
    solicitud_informacion: Info,
    copia: Copy,
    otro: AlertCircle,
  }[value],
}));

// ─── Canales de llegada ──────────────────────────────────────────────────────
const CANALES_LLEGADA = [
  { value: "email",          label: "Correo electrónico", Icon: Mail },
  { value: "carta",          label: "Carta",               Icon: FileText },
  { value: "buzon",          label: "Buzón sugerencias",  Icon: Inbox },
  { value: "entrega_fisica", label: "Entrega física",     Icon: Package },
  { value: "presencial",     label: "Presencial",          Icon: Users },
  { value: "telefono",       label: "Teléfono",           Icon: Phone },
  { value: "web",            label: "Portal web",          Icon: Globe },
];

// ─── Props ────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────
export default function NuevaPQRSModal({ onClose, onCreated }: Props) {
  const user = useAuthStore((s) => s.user);
  const aiEnabled = useMemo(
    () =>
      Boolean(
        user?.entity?.enable_ai_reports &&
          isModuleEnabled(user.entity, "enable_ai_reports") &&
          isUserModuleEnabled(user, "enable_ai_reports"),
      ),
    [user],
  );
  const [modo, setModo] = useState<"auto" | "manual">("manual");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto form
  const [archivosAuto, setArchivosAuto] = useState<File[]>([]);
  const [dragOverAuto, setDragOverAuto] = useState(false);
  const fileRefAuto = useRef<HTMLInputElement>(null);

  // Manual form
  const [archivosManual, setArchivosManual] = useState<File[]>([]);
  const [dragOverManual, setDragOverManual] = useState(false);
  const fileRefManual = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aiEnabled && modo === "auto") setModo("manual");
  }, [aiEnabled, modo]);

  const autoForm = useForm<AutoForm>({
    resolver: zodResolver(autoSchema),
    defaultValues: { texto: "", habeasData: undefined as unknown as true },
  });

  const manualForm = useForm<ManualForm>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      tipo: "",
      canalLlegada: "",
      tipoSolicitante: "natural",
      anonimo: false,
      tipoDoc: "CC",
      documento: "",
      nombres: "",
      apellidos: "",
      email: "",
      telefono: "",
      direccion: "",
      ciudad: "",
      asunto: "",
      descripcion: "",
      canalRespuesta: "email",
      fechaSolicitud: new Date().toISOString().slice(0, 10),
      habeasData: undefined as unknown as true,
    },
  });

  const anonimo = manualForm.watch("anonimo");
  const tipoSeleccionado = manualForm.watch("tipo");
  const canalRespuesta = manualForm.watch("canalRespuesta");
  const canalLlegada = manualForm.watch("canalLlegada");
  const tipoSolicitante = manualForm.watch("tipoSolicitante");

  // Re-validar cuando cambia anonimo, canal de respuesta o tipo solicitante
  useEffect(() => {
    manualForm.trigger(["documento", "nombres", "apellidos", "email", "telefono"]);
  }, [anonimo, canalRespuesta, tipoSolicitante, manualForm]);

  // Handlers archivos
  function handleFiles(files: FileList | null, mode: "auto" | "manual") {
    if (!files) return;
    const nuevos = filterValidUploadFiles(Array.from(files));
    if (nuevos.length < files.length) {
      setSubmitError(`Algunos archivos superan ${MAX_FILE_SIZE_MB} MB y fueron omitidos.`);
    }
    if (mode === "auto") {
      setArchivosAuto((prev) => {
        const merged = [...prev, ...nuevos];
        if (merged.length > MAX_ARCHIVOS_PQRS) {
          setSubmitError(`Máximo ${MAX_ARCHIVOS_PQRS} archivos permitidos.`);
        }
        return merged.slice(0, MAX_ARCHIVOS_PQRS);
      });
    } else {
      setArchivosManual((prev) => {
        const merged = [...prev, ...nuevos];
        if (merged.length > MAX_ARCHIVOS_PQRS) {
          setSubmitError(`Máximo ${MAX_ARCHIVOS_PQRS} archivos permitidos.`);
        }
        return merged.slice(0, MAX_ARCHIVOS_PQRS);
      });
    }
  }
  function removeFile(i: number, mode: "auto" | "manual") {
    if (mode === "auto") {
      setArchivosAuto((prev) => prev.filter((_, idx) => idx !== i));
    } else {
      setArchivosManual((prev) => prev.filter((_, idx) => idx !== i));
    }
  }
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function mapTipo(t: string): TipoSolicitud {
    return (t as TipoSolicitud) || "otro";
  }

  async function submitPQRS(payload: CreatePQRSPayload, archivos?: File[]) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (archivos && archivos.length > 0) {
        await pqrsApi.createWithFiles(payload, archivos);
      } else {
        await pqrsApi.create(payload);
      }
      onCreated ? onCreated() : onClose();
    } catch (err) {
      setSubmitError(formatApiError(err, "Error al enviar la PQRS."));
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmitAuto(data: AutoForm) {
    if (!data.texto?.trim() && archivosAuto.length === 0) {
      setSubmitError("Ingresa texto o adjunta al menos un documento.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    pqrsApi
      .autoCreate(data.texto || "", archivosAuto)
      .then(() => (onCreated ? onCreated() : onClose()))
      .catch((err) => {
        setSubmitError(formatApiError(err, "Error procesando con IA."));
      })
      .finally(() => setSubmitting(false));
  }
  function onSubmitManual(data: ManualForm) {
    const payload: CreatePQRSPayload = {
      tipo_solicitud: mapTipo(data.tipo),
      asunto: data.asunto,
      descripcion: data.descripcion,
      canal_llegada: (data.canalLlegada || "web") as CreatePQRSPayload["canal_llegada"],
      medio_respuesta: data.canalRespuesta || "email",
    };
    if (!data.anonimo) {
      const isJuridica = data.tipoSolicitante === "juridica";
      payload.tipo_persona = data.tipoSolicitante;
      payload.tipo_identificacion = isJuridica ? "NIT" : (data.tipoDoc || "CC");
      payload.cedula_ciudadano = data.documento;
      payload.nombre_ciudadano = isJuridica
        ? data.nombres?.trim() || ""
        : `${data.nombres} ${data.apellidos}`.trim();
      payload.email_ciudadano = data.email;
      payload.telefono_ciudadano = data.telefono;
      payload.direccion_ciudadano = data.direccion;
    }
    if (data.fechaSolicitud) {
      payload.fecha_solicitud = new Date(data.fechaSolicitud).toISOString();
    }
    submitPQRS(payload, archivosManual);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold leading-tight text-slate-800">
                <FileText className="h-4 w-4 text-emerald-600" />
                Nueva PQRSD
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                Conforme a la Ley 1755 de 2015 — Derecho fundamental de petición
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Selector de modo ── */}
          {aiEnabled && (
          <div className="mx-6 mt-5 flex gap-2 rounded-xl bg-slate-100 p-1">
            {[
              { key: "auto" as const, Icon: Sparkles, title: "Automática", desc: "Solo describe tu solicitud y adjunta archivos" },
              { key: "manual" as const, Icon: LayoutGrid, title: "Manual", desc: "Formulario completo con todos los datos" },
            ].map(({ key, Icon, title, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => setModo(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-center transition-all ${
                  modo === key
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className={`h-4 w-4 ${key === "auto" ? "text-purple-500" : "text-emerald-600"}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-none">{title}</div>
                  <div className="mt-0.5 hidden truncate text-xs text-slate-400 sm:block">{desc}</div>
                </div>
              </button>
            ))}
          </div>
          )}

          {/* ══════════ MODO AUTO ══════════ */}
          {aiEnabled && modo === "auto" && (
            <form
              onSubmit={autoForm.handleSubmit(onSubmitAuto)}
              className="flex min-h-0 flex-1 flex-col"
              noValidate
            >
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* Sección título */}
                <SectionTitle Icon={Sparkles}>Describe tu solicitud</SectionTitle>

                <div className="mb-5">
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <AlignLeft className="h-3.5 w-3.5" />
                    Texto de la solicitud <span className="text-slate-400">(opcional si adjuntas documento)</span>
                  </label>
                  <textarea
                    {...autoForm.register("texto")}
                    rows={6}
                    placeholder="Describe con tus propias palabras lo que necesitas, o adjunta un documento. La IA leerá el contenido, clasificará el trámite, extraerá los datos del ciudadano y dirigirá la PQRSD a la secretaría correspondiente automáticamente."
                    className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-1 ${
                      autoForm.formState.errors.texto
                        ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                        : "border-slate-200 focus:border-purple-400 focus:ring-purple-400"
                    }`}
                  />
                  {autoForm.formState.errors.texto && (
                    <InvalidMsg msg={autoForm.formState.errors.texto.message!} />
                  )}
                </div>

                {/* Archivos */}
                <SectionTitle Icon={CloudUpload}>
                  Archivos adjuntos <span className="ml-1 font-normal text-slate-400">(máx {MAX_ARCHIVOS_PQRS})</span>
                </SectionTitle>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverAuto(true); }}
                  onDragLeave={() => setDragOverAuto(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOverAuto(false); handleFiles(e.dataTransfer.files, "auto"); }}
                  onClick={() => fileRefAuto.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all ${
                    dragOverAuto ? "border-purple-300 bg-purple-50" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <CloudUpload className="mx-auto mb-1 h-7 w-7 text-slate-300" />
                  <div className="text-sm text-slate-500">Arrastra y suelta tus archivos aquí</div>
                  <div className="text-xs text-slate-400">o</div>
                  <span className="mt-1.5 inline-block text-sm font-medium text-purple-600">
                    Seleccionar archivos
                  </span>
                  <input ref={fileRefAuto} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files, "auto")} />
                </div>

                {archivosAuto.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {archivosAuto.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                        <FileIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <span className="flex-1 truncate text-slate-700">{f.name}</span>
                        <span className="text-xs text-slate-400">{formatSize(f.size)}</span>
                        <button type="button" onClick={() => removeFile(i, "auto")} className="text-slate-400 hover:text-red-500">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Habeas Data */}
                <HabeasData
                  checked={!!autoForm.watch("habeasData")}
                  onChange={(val) => autoForm.setValue("habeasData", val as true, { shouldValidate: true })}
                  error={autoForm.formState.errors.habeasData?.message}
                />
                {submitError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>
                )}
              </div>

              <ModalFooter onClose={onClose} submitting={submitting} submittingText="Procesando con IA…" />
            </form>
          )}

          {/* ══════════ MODO MANUAL ══════════ */}
          {modo === "manual" && (
            <form
              onSubmit={manualForm.handleSubmit(onSubmitManual)}
              className="flex min-h-0 flex-1 flex-col"
              noValidate
            >
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* Tipo de trámite */}
                <SectionTitle Icon={FileText}>
                  Tipo de trámite <span className="text-red-500">*</span>
                </SectionTitle>
                <div className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIPOS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => manualForm.setValue("tipo", value, { shouldValidate: true })}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-all ${
                        tipoSeleccionado === value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : manualForm.formState.errors.tipo
                          ? "border-red-300 text-red-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="leading-tight">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
                {manualForm.formState.errors.tipo && (
                  <InvalidMsg msg={manualForm.formState.errors.tipo.message!} />
                )}

                {/* Canal de llegada */}
                <SectionTitle Icon={Inbox}>
                  ¿Cómo llegó la solicitud? <span className="text-red-500">*</span>
                </SectionTitle>
                <div className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CANALES_LLEGADA.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => manualForm.setValue("canalLlegada", value, { shouldValidate: true })}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-all ${
                        canalLlegada === value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : manualForm.formState.errors.canalLlegada
                          ? "border-red-300 text-red-600"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="leading-tight">
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
                {manualForm.formState.errors.canalLlegada && (
                  <InvalidMsg msg={manualForm.formState.errors.canalLlegada.message!} />
                )}

                {/* Datos del solicitante */}
                <SectionTitle Icon={User}>Datos del solicitante</SectionTitle>

                {/* Toggle anónimo */}
                <label className="mb-4 flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <User className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  <span className="flex-1 text-sm font-medium text-slate-700">
                    <strong>Trámite anónimo</strong> — No deseo proporcionar mis datos personales
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      {...manualForm.register("anonimo")}
                      className="sr-only"
                    />
                    <div
                      onClick={() => manualForm.setValue("anonimo", !anonimo)}
                      className={`flex h-6 w-11 items-center rounded-full transition-colors ${anonimo ? "bg-emerald-500" : "bg-slate-200"}`}
                    >
                      <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${anonimo ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </div>
                </label>

                {!anonimo && (
                  <>
                    {/* Toggle tipo de solicitante — solo visible cuando no es anónimo */}
                    <div className="mb-3 flex gap-2">
                      {[
                        { value: "natural" as const, label: "Persona natural", Icon: User },
                        { value: "juridica" as const, label: "Entidad / Empresa", Icon: Briefcase },
                      ].map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            manualForm.setValue("tipoSolicitante", value, { shouldValidate: false });
                            if (value === "juridica") manualForm.setValue("tipoDoc", "NIT");
                            else manualForm.setValue("tipoDoc", "CC");
                          }}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition-all ${
                            tipoSolicitante === value
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      {/* Tipo doc (solo persona natural) — igual ancho que documento */}
                      {tipoSolicitante === "natural" && (
                        <div className="col-span-6">
                          <FieldLabel Icon={CreditCard}>Tipo doc. <span className="text-red-500">*</span></FieldLabel>
                          <select
                            {...manualForm.register("tipoDoc")}
                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                          >
                            <option value="CC">Cédula de ciudadanía</option>
                            <option value="CE">Cédula de extranjería</option>
                            <option value="TI">Tarjeta de identidad</option>
                            <option value="PA">Pasaporte</option>
                          </select>
                        </div>
                      )}
                      {/* Documento / NIT */}
                      <div className={tipoSolicitante === "natural" ? "col-span-6" : "col-span-12"}>
                        <FieldLabel Icon={CreditCard}>
                          {tipoSolicitante === "juridica" ? "NIT" : "Número de documento"} <span className="text-red-500">*</span>
                        </FieldLabel>
                        <IconInput
                          Icon={CreditCard}
                          placeholder={tipoSolicitante === "juridica" ? "Ej. 900123456-7" : "Ej. 1023456789"}
                          error={!!manualForm.formState.errors.documento}
                          {...manualForm.register("documento")}
                        />
                        {manualForm.formState.errors.documento && (
                          <InvalidMsg msg={manualForm.formState.errors.documento.message!} />
                        )}
                      </div>
                      {/* Nombres / Razón social */}
                      <div className="col-span-6">
                        <FieldLabel Icon={tipoSolicitante === "juridica" ? Briefcase : User}>
                          {tipoSolicitante === "juridica" ? "Razón social" : "Nombres"} <span className="text-red-500">*</span>
                        </FieldLabel>
                        <IconInput
                          Icon={tipoSolicitante === "juridica" ? Briefcase : User}
                          placeholder={tipoSolicitante === "juridica" ? "Nombre de la entidad" : "Ej. María Camila"}
                          error={!!manualForm.formState.errors.nombres}
                          {...manualForm.register("nombres")}
                        />
                        {manualForm.formState.errors.nombres && (
                          <InvalidMsg msg={manualForm.formState.errors.nombres.message!} />
                        )}
                      </div>
                      {/* Apellidos (natural) / Representante legal (jurídica, opcional) */}
                      <div className="col-span-6">
                        <FieldLabel Icon={User}>
                          {tipoSolicitante === "juridica" ? "Representante legal" : "Apellidos"}
                          {tipoSolicitante === "natural" && <span className="text-red-500"> *</span>}
                        </FieldLabel>
                        <IconInput
                          Icon={User}
                          placeholder={tipoSolicitante === "juridica" ? "Nombre del representante" : "Ej. Rodríguez Pérez"}
                          error={!!manualForm.formState.errors.apellidos}
                          {...manualForm.register("apellidos")}
                        />
                        {manualForm.formState.errors.apellidos && (
                          <InvalidMsg msg={manualForm.formState.errors.apellidos.message!} />
                        )}
                      </div>

                      {/* Canal de respuesta preferido */}
                      <div className="col-span-12">
                        <FieldLabel Icon={Send}>Canal de respuesta preferido</FieldLabel>
                        <select
                          {...manualForm.register("canalRespuesta")}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        >
                          <option value="email">Correo electrónico</option>
                          <option value="fisica">Correspondencia física</option>
                          <option value="telefono">Llamada telefónica</option>
                          <option value="presencial">Presencial</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>

                      {/* Campo de contacto según canal */}
                      {canalRespuesta === "email" && (
                        <div className="col-span-12">
                          <FieldLabel Icon={Mail}>Correo electrónico <span className="text-red-500">*</span></FieldLabel>
                          <IconInput
                            Icon={Mail}
                            type="email"
                            placeholder="ejemplo@correo.com; otro@correo.com"
                            error={!!manualForm.formState.errors.email}
                            {...manualForm.register("email")}
                          />
                          {manualForm.formState.errors.email && (
                            <InvalidMsg msg={manualForm.formState.errors.email.message!} />
                          )}
                          <p className="mt-1 text-[0.7rem] text-slate-400">
                            Puedes ingresar varios correos separados por <strong>;</strong> o <strong>,</strong>
                          </p>
                        </div>
                      )}
                      {canalRespuesta === "telefono" && (
                        <div className="col-span-12">
                          <FieldLabel Icon={Phone}>Teléfono <span className="text-red-500">*</span></FieldLabel>
                          <IconInput
                            Icon={Phone}
                            placeholder="+57 301 1234567"
                            error={!!manualForm.formState.errors.telefono}
                            {...manualForm.register("telefono")}
                          />
                          {manualForm.formState.errors.telefono && (
                            <InvalidMsg msg={manualForm.formState.errors.telefono.message!} />
                          )}
                        </div>
                      )}
                      {canalRespuesta === "fisica" && (
                        <>
                          <div className="col-span-8">
                            <FieldLabel Icon={MapPin}>Dirección de notificación <span className="text-red-500">*</span></FieldLabel>
                            <IconInput Icon={MapPin} placeholder="Calle 10 # 5-23" {...manualForm.register("direccion")} />
                          </div>
                          <div className="col-span-4">
                            <FieldLabel Icon={Building}>Ciudad / Municipio</FieldLabel>
                            <IconInput Icon={Building} placeholder="Ej. Chiquiza" {...manualForm.register("ciudad")} />
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Detalle */}
                <SectionTitle Icon={AlignLeft}>Detalle de la solicitud</SectionTitle>

                {/* Fecha de la solicitud */}
                <div className="mb-3">
                  <FieldLabel Icon={CalendarDays}>Fecha de la solicitud</FieldLabel>
                  <input
                    type="date"
                    {...manualForm.register("fechaSolicitud")}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                {/* Asunto */}
                <div className="mb-3">
                  <FieldLabel Icon={Bookmark}>Asunto <span className="text-red-500">*</span></FieldLabel>
                  <IconInput
                    Icon={Bookmark}
                    placeholder="Resume tu solicitud en una línea"
                    error={!!manualForm.formState.errors.asunto}
                    {...manualForm.register("asunto")}
                  />
                  {manualForm.formState.errors.asunto && (
                    <InvalidMsg msg={manualForm.formState.errors.asunto.message!} />
                  )}
                </div>

                {/* Descripción */}
                <div className="mb-3">
                  <FieldLabel Icon={AlignLeft}>Descripción detallada <span className="text-red-500">*</span></FieldLabel>
                  <textarea
                    {...manualForm.register("descripcion")}
                    rows={5}
                    placeholder="Describe los hechos, fechas y circunstancias relevantes de tu solicitud."
                    className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-1 ${
                      manualForm.formState.errors.descripcion
                        ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                        : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-400"
                    }`}
                  />
                  {manualForm.formState.errors.descripcion && (
                    <InvalidMsg msg={manualForm.formState.errors.descripcion.message!} />
                  )}
                </div>

                {/* Archivos adjuntos */}
                <SectionTitle Icon={CloudUpload}>
                  Archivos adjuntos <span className="ml-1 font-normal text-slate-400">(máx {MAX_ARCHIVOS_PQRS} archivos · {MAX_FILE_SIZE_MB} MB c/u)</span>
                </SectionTitle>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverManual(true); }}
                  onDragLeave={() => setDragOverManual(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOverManual(false); handleFiles(e.dataTransfer.files, "manual"); }}
                  onClick={() => fileRefManual.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all ${
                    dragOverManual ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <CloudUpload className="mx-auto mb-1 h-7 w-7 text-slate-300" />
                  <div className="text-sm text-slate-500">Arrastra y suelta tus archivos aquí</div>
                  <div className="text-xs text-slate-400">o</div>
                  <span className="mt-1.5 inline-block text-sm font-medium text-emerald-600">
                    Seleccionar archivos
                  </span>
                  <input ref={fileRefManual} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files, "manual")} />
                </div>

                {archivosManual.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {archivosManual.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                        <FileIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <span className="flex-1 truncate text-slate-700">{f.name}</span>
                        <span className="text-xs text-slate-400">{formatSize(f.size)}</span>
                        <button type="button" onClick={() => removeFile(i, "manual")} className="text-slate-400 hover:text-red-500">
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Habeas Data */}
                <HabeasData
                  checked={!!manualForm.watch("habeasData")}
                  onChange={(val) => manualForm.setValue("habeasData", val as true, { shouldValidate: true })}
                  error={manualForm.formState.errors.habeasData?.message}
                />
                {submitError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>
                )}
              </div>

              <ModalFooter onClose={onClose} submitting={submitting} />
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────
function SectionTitle({ Icon, children }: { Icon: React.FC<React.SVGProps<SVGSVGElement>>; children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-slate-700 first:mt-0">
      <Icon className="h-4 w-4 text-slate-400" />
      {children}
    </div>
  );
}

function FieldLabel({ Icon, children }: { Icon: React.FC<React.SVGProps<SVGSVGElement>>; children: React.ReactNode }) {
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
      <Icon className="h-4 w-4 text-slate-400" />
      {children}
    </label>
  );
}

const IconInput = ({
  Icon,
  error,
  ...props
}: {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  error?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="relative">
    <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input
      {...props}
      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-1 ${
        error
          ? "border-red-300 focus:border-red-400 focus:ring-red-400"
          : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-400"
      }`}
    />
  </div>
);

function InvalidMsg({ msg }: { msg: string }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-xs text-red-500">
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
      {msg}
    </div>
  );
}

function HabeasData({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  error?: string;
}) {
  return (
    <div className="mt-4">
      <div className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs leading-relaxed text-slate-600 ${error ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600"
        />
        <span>
          Acepto el{" "}
          <a href="#" target="_blank" className="font-semibold text-emerald-600 hover:underline">
            tratamiento de mis datos personales
          </a>{" "}
          conforme a la Ley 1581 de 2012 y autorizo a la entidad a contactarme para dar respuesta a esta solicitud.{" "}
          <span className="text-red-500">*</span>
        </span>
      </div>
      {error && <InvalidMsg msg={error} />}
    </div>
  );
}

function ModalFooter({ onClose, submitting, submittingText }: { onClose: () => void; submitting?: boolean; submittingText?: string }) {
  return (
    <div className="flex gap-2.5 border-t border-slate-200 bg-white px-6 py-4">
      <button
        type="button"
        onClick={onClose}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <X className="h-4 w-4" />
        Cancelar
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {submitting ? (submittingText || "Enviando…") : "Enviar PQRSD"}
      </button>
    </div>
  );
}
