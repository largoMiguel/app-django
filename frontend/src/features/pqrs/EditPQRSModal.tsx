import {
  X,
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
  Pencil,
  CalendarDays,
  Inbox,
  Package,
  Users,
  Globe,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useEffect } from "react";
import { formatApiError } from "@/core/api/errors";
import { dateInputValueToIsoCO, todayDateInputValueCO, toDateInputValueCO } from "@/core/datetime";
import { TIPO_SOLICITUD_LABEL } from "@/features/pqrs/labels";
import {
  pqrsApi,
  type PQRS,
  type CreatePQRSPayload,
  type TipoSolicitud,
  type PQRSArchivoItem,
  MAX_ARCHIVOS_PQRS,
  MAX_FILE_SIZE_MB,
  filterValidUploadFiles,
} from "@/core/api/pqrs";
import { openAuthenticatedFile } from "@/core/api/client";

// ─── Mapeos ──────────────────────────────────────────────────────────
const TIPOS = (Object.keys(TIPO_SOLICITUD_LABEL) as TipoSolicitud[])
  .filter((value) => value !== "otro")
  .map((value) => ({
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

function mapTipoToKey(t: TipoSolicitud): string {
  return t;
}

function mapKeyToTipo(k: string): TipoSolicitud {
  return (k as TipoSolicitud) || "otro";
}

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

// ─── Schema ──────────────────────────────────────────────────────────
const schema = z
  .object({
    tipo: z.string().min(1, "Selecciona el tipo de trámite."),
    canalLlegada: z.string().optional(),
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
    descripcion: z.string().min(10, "Describe con al menos 10 caracteres."),
    canalRespuesta: z.string().optional(),
    fechaSolicitud: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.anonimo && data.canalRespuesta === "email") {
      if (!data.email || !data.email.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "El correo es obligatorio cuando el canal de respuesta es email.",
        });
      } else {
        const emails = data.email.split(/[;,]/).map((e) => e.trim()).filter(Boolean);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const em of emails) {
          if (!emailRegex.test(em)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["email"],
              message: `"${em}" no es un correo válido.`,
            });
            break;
          }
        }
      }
    }
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  pqrs: PQRS;
  onClose: () => void;
  onSaved: (updated: PQRS) => void;
}

export default function EditPQRSModal({ pqrs, onClose, onSaved }: Props) {
  const esAnonima =
    pqrs.is_anonima ?? !(pqrs.nombre_ciudadano && pqrs.nombre_ciudadano.trim());

  // Split nombre en nombres/apellidos (primer espacio)
  const nombreCompleto = pqrs.nombre_ciudadano || "";
  const spaceIdx = nombreCompleto.indexOf(" ");
  const defaultNombres =
    spaceIdx > -1 ? nombreCompleto.slice(0, spaceIdx) : nombreCompleto;
  const defaultApellidos = spaceIdx > -1 ? nombreCompleto.slice(spaceIdx + 1) : "";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: mapTipoToKey(pqrs.tipo_solicitud),
      canalLlegada: pqrs.canal_llegada || "presencial",
      anonimo: esAnonima,
      tipoDoc: pqrs.tipo_identificacion || "CC",
      documento: pqrs.cedula_ciudadano || "",
      nombres: defaultNombres,
      apellidos: defaultApellidos,
      email: pqrs.email_ciudadano || "",
      telefono: pqrs.telefono_ciudadano || "",
      direccion: pqrs.direccion_ciudadano || "",
      ciudad: "",
      asunto: pqrs.asunto,
      descripcion: pqrs.descripcion,
      canalRespuesta: pqrs.medio_respuesta || "email",
      fechaSolicitud: pqrs.fecha_solicitud
        ? toDateInputValueCO(pqrs.fecha_solicitud)
        : todayDateInputValueCO(),
    },
  });

  const [archivos, setArchivos] = useState<File[]>([]);
  const [archivosExistentes, setArchivosExistentes] = useState<PQRSArchivoItem[]>(
    pqrs.archivos || [],
  );
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const anonimo = form.watch("anonimo");
  const tipoSeleccionado = form.watch("tipo");
  const canalLlegada = form.watch("canalLlegada");
  const canalRespuesta = form.watch("canalRespuesta");

  useEffect(() => {
    form.trigger(["documento", "nombres", "apellidos", "email", "telefono"]);
  }, [anonimo, form]);

  const totalArchivos = archivosExistentes.length + archivos.length;
  const slotsDisponibles = Math.max(0, MAX_ARCHIVOS_PQRS - archivosExistentes.length);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const nuevos = filterValidUploadFiles(Array.from(files));
    if (nuevos.length < files.length) {
      setSubmitError(`Algunos archivos superan ${MAX_FILE_SIZE_MB} MB y fueron omitidos.`);
    }
    setArchivos((prev) => {
      const merged = [...prev, ...nuevos];
      const max = slotsDisponibles;
      if (merged.length > max) {
        setSubmitError(`Máximo ${MAX_ARCHIVOS_PQRS} archivos (ya hay ${archivosExistentes.length}).`);
      }
      return merged.slice(0, max);
    });
  }
  function removeFile(i: number) {
    setArchivos((prev) => prev.filter((_, idx) => idx !== i));
  }
  async function removeExistente(id: number) {
    if (!confirm("¿Eliminar este archivo adjunto?")) return;
    try {
      await pqrsApi.removeArchivo(pqrs.id, id);
      setArchivosExistentes((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setSubmitError("No se pudo eliminar el archivo.");
    }
  }
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Partial<CreatePQRSPayload> = {
        tipo_solicitud: mapKeyToTipo(data.tipo),
        asunto: data.asunto,
        descripcion: data.descripcion,
        medio_respuesta: data.canalRespuesta || "email",
        canal_llegada: (data.canalLlegada || "presencial") as CreatePQRSPayload["canal_llegada"],
      };
      if (!data.anonimo) {
        payload.tipo_identificacion = data.tipoDoc || "CC";
        payload.cedula_ciudadano = data.documento;
        payload.nombre_ciudadano = `${data.nombres || ""} ${data.apellidos || ""}`.trim();
        payload.email_ciudadano = data.email;
        payload.telefono_ciudadano = data.telefono;
        payload.direccion_ciudadano = data.direccion;
      } else {
        // limpiar datos personales
        payload.nombre_ciudadano = "";
        payload.cedula_ciudadano = "";
        payload.email_ciudadano = "";
        payload.telefono_ciudadano = "";
        payload.direccion_ciudadano = "";
      }
      if (data.fechaSolicitud) {
        payload.fecha_solicitud = dateInputValueToIsoCO(data.fechaSolicitud);
      }
      const updated = archivos.length > 0
        ? await pqrsApi.updateWithFiles(pqrs.id, payload, archivos)
        : await pqrsApi.update(pqrs.id, payload);
      onSaved(updated);
    } catch (err) {
      setSubmitError(formatApiError(err, "Error al guardar."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
          noValidate
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold leading-tight text-slate-800">
                <Pencil className="h-4 w-4 text-emerald-600" />
                Editar PQRS
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                {pqrs.numero_radicado}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
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
                  onClick={() => form.setValue("tipo", value, { shouldValidate: true })}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-all ${
                    tipoSeleccionado === value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : form.formState.errors.tipo
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
            {form.formState.errors.tipo && (
              <InvalidMsg msg={form.formState.errors.tipo.message!} />
            )}

            {/* Canal de llegada */}
            <SectionTitle Icon={Inbox}>
              ¿Cómo llegó la solicitud?
            </SectionTitle>
            <div className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CANALES_LLEGADA.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => form.setValue("canalLlegada", value, { shouldValidate: true })}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition-all ${
                    canalLlegada === value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
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

            {/* Datos del solicitante */}
            <SectionTitle Icon={User}>Datos del solicitante</SectionTitle>
            <label className="mb-4 flex cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <User className="h-5 w-5 flex-shrink-0 text-slate-400" />
              <span className="flex-1 text-sm font-medium text-slate-700">
                <strong>Trámite anónimo</strong> — No se proporcionan datos personales
              </span>
              <div className="relative">
                <input type="checkbox" {...form.register("anonimo")} className="sr-only" />
                <div
                  onClick={() => form.setValue("anonimo", !anonimo)}
                  className={`flex h-6 w-11 items-center rounded-full transition-colors ${anonimo ? "bg-emerald-500" : "bg-slate-200"}`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${anonimo ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </div>
              </div>
            </label>

            {!anonimo && (
              <div className="grid grid-cols-12 gap-3">
                {/* Tipo doc — igual ancho que documento */}
                <div className="col-span-6">
                  <FieldLabel Icon={CreditCard}>
                    Tipo doc. <span className="text-red-500">*</span>
                  </FieldLabel>
                  <select
                    {...form.register("tipoDoc")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value="CC">Cédula de ciudadanía</option>
                    <option value="CE">Cédula de extranjería</option>
                    <option value="TI">Tarjeta de identidad</option>
                    <option value="PA">Pasaporte</option>
                    <option value="NIT">NIT</option>
                  </select>
                </div>
                <div className="col-span-6">
                  <FieldLabel Icon={CreditCard}>
                    Número de documento <span className="text-red-500">*</span>
                  </FieldLabel>
                  <IconInput
                    Icon={CreditCard}
                    placeholder="Ej. 1023456789"
                    error={!!form.formState.errors.documento}
                    {...form.register("documento")}
                  />
                </div>
                <div className="col-span-6">
                  <FieldLabel Icon={User}>
                    Nombres <span className="text-red-500">*</span>
                  </FieldLabel>
                  <IconInput
                    Icon={User}
                    placeholder="Ej. María Camila"
                    error={!!form.formState.errors.nombres}
                    {...form.register("nombres")}
                  />
                </div>
                <div className="col-span-6">
                  <FieldLabel Icon={User}>
                    Apellidos <span className="text-red-500">*</span>
                  </FieldLabel>
                  <IconInput
                    Icon={User}
                    placeholder="Ej. Rodríguez Pérez"
                    error={!!form.formState.errors.apellidos}
                    {...form.register("apellidos")}
                  />
                </div>

                {/* Canal de respuesta */}
                <div className="col-span-12">
                  <FieldLabel Icon={Send}>Canal de respuesta preferido</FieldLabel>
                  <select
                    {...form.register("canalRespuesta")}
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
                    <FieldLabel Icon={Mail}>
                      Correo electrónico <span className="text-red-500">*</span>
                    </FieldLabel>
                    <IconInput
                      Icon={Mail}
                      placeholder="ejemplo@correo.com; otro@correo.com"
                      error={!!form.formState.errors.email}
                      {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                      <InvalidMsg msg={form.formState.errors.email.message!} />
                    )}
                    <p className="mt-1 text-[0.7rem] text-slate-400">
                      Puedes ingresar varios correos separados por <strong>;</strong> o <strong>,</strong>
                    </p>
                  </div>
                )}
                {canalRespuesta === "telefono" && (
                  <div className="col-span-12">
                    <FieldLabel Icon={Phone}>
                      Teléfono <span className="text-red-500">*</span>
                    </FieldLabel>
                    <IconInput
                      Icon={Phone}
                      placeholder="+57 301 1234567"
                      error={!!form.formState.errors.telefono}
                      {...form.register("telefono")}
                    />
                  </div>
                )}
                {canalRespuesta === "fisica" && (
                  <>
                    <div className="col-span-8">
                      <FieldLabel Icon={MapPin}>Dirección de notificación</FieldLabel>
                      <IconInput Icon={MapPin} placeholder="Calle 10 # 5-23" {...form.register("direccion")} />
                    </div>
                    <div className="col-span-4">
                      <FieldLabel Icon={Building}>Ciudad / Municipio</FieldLabel>
                      <IconInput Icon={Building} placeholder="Ej. Chiquiza" {...form.register("ciudad")} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Detalle */}
            <SectionTitle Icon={AlignLeft}>Detalle de la solicitud</SectionTitle>
            <div className="mb-3">
              <FieldLabel Icon={CalendarDays}>Fecha de la solicitud</FieldLabel>
              <input
                type="date"
                {...form.register("fechaSolicitud")}
                max={todayDateInputValueCO()}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div className="mb-3">
              <FieldLabel Icon={Bookmark}>
                Asunto <span className="text-red-500">*</span>
              </FieldLabel>
              <IconInput
                Icon={Bookmark}
                placeholder="Resume tu solicitud en una línea"
                error={!!form.formState.errors.asunto}
                {...form.register("asunto")}
              />
              {form.formState.errors.asunto && (
                <InvalidMsg msg={form.formState.errors.asunto.message!} />
              )}
            </div>
            <div className="mb-3">
              <FieldLabel Icon={AlignLeft}>
                Descripción detallada <span className="text-red-500">*</span>
              </FieldLabel>
              <textarea
                {...form.register("descripcion")}
                rows={5}
                placeholder="Describe los hechos, fechas y circunstancias relevantes."
                className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-1 ${
                  form.formState.errors.descripcion
                    ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                    : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-400"
                }`}
              />
              {form.formState.errors.descripcion && (
                <InvalidMsg msg={form.formState.errors.descripcion.message!} />
              )}
            </div>

            {/* Archivos adjuntos */}
            <SectionTitle Icon={CloudUpload}>
              Archivos adjuntos <span className="ml-1 font-normal text-slate-400">({totalArchivos}/{MAX_ARCHIVOS_PQRS} · máx {MAX_FILE_SIZE_MB} MB c/u)</span>
            </SectionTitle>
            {archivosExistentes.length > 0 && (
              <div className="mb-3 flex flex-col gap-1.5">
                {archivosExistentes.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
                  >
                    <FileIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => a.url && openAuthenticatedFile(a.url)}
                      className="flex-1 truncate text-left font-medium text-emerald-700 hover:underline"
                    >
                      {a.nombre}
                    </button>
                    <span className="text-xs text-slate-400">{formatSize(a.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeExistente(a.id)}
                      className="text-slate-400 hover:text-red-500"
                      title="Eliminar"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {slotsDisponibles > 0 ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all ${
                  dragOver
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <CloudUpload className="mx-auto mb-1 h-7 w-7 text-slate-300" />
                <div className="text-sm text-slate-500">Arrastra y suelta aquí</div>
                <div className="text-xs text-slate-400">o</div>
                <span className="mt-1.5 inline-block text-sm font-medium text-emerald-600">
                  Seleccionar archivos
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.78rem] text-amber-800">
                Límite de {MAX_ARCHIVOS_PQRS} archivos alcanzado. Elimina alguno para subir más.
              </div>
            )}
            {archivos.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {archivos.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
                  >
                    <FileIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <span className="flex-1 truncate text-slate-700">{f.name}</span>
                    <span className="text-xs text-slate-400">{formatSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {submitError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 border-t border-slate-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────

function SectionTitle({
  Icon,
  children,
}: {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-slate-700 first:mt-0">
      <Icon className="h-4 w-4 text-slate-400" />
      {children}
    </div>
  );
}

function FieldLabel({
  Icon,
  children,
}: {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
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
