import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import type { PdmActividad } from "@/core/api/pdm";
import type { Secretaria } from "@/core/api/entities";
import { PdmAlert, PdmCard, PdmModal } from "@/features/pdm/components/PdmUi";
import { pdmBtnPrimary, pdmBtnSecondary, pdmInput, pdmSelect } from "@/features/pdm/pdmLayout";
import {
  calcularMetaDisponible,
  formatearNumero,
  validarMetaActividad,
  type ResumenProducto,
} from "@/features/pdm/pdmUtils";

export interface ActividadFormValues {
  nombre: string;
  descripcion: string;
  responsable_secretaria_id: number | null;
  estado: PdmActividad["estado"];
  fecha_inicio: string;
  fecha_fin: string;
  meta_ejecutar: number;
  evidencia_url: string;
  imagenes: string[];
}

interface PdmActividadModalProps {
  open: boolean;
  anio: number;
  producto: ResumenProducto;
  secretarias: Secretaria[];
  actividadEnEdicion: PdmActividad | null;
  secretariaUsuarioId?: number | null;
  esSecretario: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: ActividadFormValues) => Promise<void>;
}

const EMPTY_FORM: ActividadFormValues = {
  nombre: "",
  descripcion: "",
  responsable_secretaria_id: null,
  estado: "COMPLETADA",
  fecha_inicio: "",
  fecha_fin: "",
  meta_ejecutar: 0,
  evidencia_url: "",
  imagenes: [],
};

const labelClass = "mb-1 block text-xs font-medium text-slate-600";
const textareaClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

function readImagesAsBase64(files: FileList | null): Promise<string[]> {
  if (!files?.length) return Promise.resolve([]);
  return Promise.all(
    Array.from(files)
      .slice(0, 4)
      .map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("No se pudo leer una imagen."));
            reader.readAsDataURL(file);
          }),
      ),
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export default function PdmActividadModal({
  open,
  anio,
  producto,
  secretarias,
  actividadEnEdicion,
  secretariaUsuarioId,
  esSecretario,
  saving,
  onClose,
  onSave,
}: PdmActividadModalProps) {
  const [form, setForm] = useState<ActividadFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const metaDisponible = useMemo(() => {
    if (actividadEnEdicion) {
      return validarMetaActividad(producto, anio, 0, actividadEnEdicion.id).disponible;
    }
    return calcularMetaDisponible(producto, anio);
  }, [actividadEnEdicion, anio, producto]);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (actividadEnEdicion) {
      setForm({
        nombre: actividadEnEdicion.nombre,
        descripcion: actividadEnEdicion.descripcion || "",
        responsable_secretaria_id: actividadEnEdicion.responsable_secretaria || null,
        estado: actividadEnEdicion.estado,
        fecha_inicio: (actividadEnEdicion.fecha_inicio || "").slice(0, 10),
        fecha_fin: (actividadEnEdicion.fecha_fin || "").slice(0, 10),
        meta_ejecutar: Number(actividadEnEdicion.meta_ejecutar || 0),
        evidencia_url: actividadEnEdicion.evidencia?.url_evidencia || "",
        imagenes: actividadEnEdicion.evidencia?.imagenes ? [...actividadEnEdicion.evidencia.imagenes] : [],
      });
      return;
    }
    setForm({
      ...EMPTY_FORM,
      responsable_secretaria_id: esSecretario ? secretariaUsuarioId || null : null,
      fecha_inicio: `${anio}-01-01`,
      fecha_fin: `${anio}-12-31`,
    });
  }, [open, actividadEnEdicion, anio, esSecretario, secretariaUsuarioId]);

  const tieneEvidenciaValida = Boolean(form.evidencia_url.trim() || form.imagenes.length > 0);
  const canSubmit =
    form.nombre.trim().length >= 5 &&
    form.descripcion.trim().length >= 10 &&
    Boolean(form.responsable_secretaria_id) &&
    Boolean(form.fecha_inicio && form.fecha_fin) &&
    form.meta_ejecutar > 0 &&
    form.meta_ejecutar <= metaDisponible &&
    tieneEvidenciaValida;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const validacion = validarMetaActividad(producto, anio, form.meta_ejecutar, actividadEnEdicion?.id);
    if (!validacion.valido) {
      setFormError(validacion.mensaje);
      return;
    }
    if (!tieneEvidenciaValida) {
      setFormError("Debe proporcionar al menos una URL de evidencia o cargar imágenes.");
      return;
    }
    await onSave(form);
  }

  const titulo = actividadEnEdicion ? "Editar evidencia de ejecución" : "Nueva evidencia de ejecución";

  return (
    <PdmModal
      open={open}
      wide
      headerTone="primary"
      title={`${titulo} — ${anio}`}
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        {formError && <PdmAlert tone="error">{formError}</PdmAlert>}

        <PdmAlert tone="info">
          <strong>Meta disponible:</strong> {formatearNumero(metaDisponible)} {producto.unidad_medida || ""}
          {metaDisponible <= 0 && (
            <span className="mt-1 block text-amber-800">
              No hay meta disponible para este año. Verifique la programación del producto.
            </span>
          )}
        </PdmAlert>

        <PdmCard
          title={
            <span className="flex items-center gap-2">
              <ClipboardCheck size={16} />
              Información de la evidencia
            </span>
          }
        >
          <div className="space-y-4">
            <Field label="Nombre de la evidencia *">
              <input className={pdmInput}
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Capacitación en gestión de proyectos"
              />
            </Field>

            <Field label="Descripción *">
              <textarea
                className={textareaClass}
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Describa la evidencia de ejecución de la meta"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Secretaría responsable *">
                <select className={pdmSelect}
                  value={form.responsable_secretaria_id || ""}
                  disabled={esSecretario}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      responsable_secretaria_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">Seleccione...</option>
                  {secretarias.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estado *">
                <select className={pdmSelect}
                  value={form.estado}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, estado: e.target.value as PdmActividad["estado"] }))
                  }
                >
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_PROGRESO">En progreso</option>
                  <option value="CANCELADA">Cancelada</option>
                  <option value="COMPLETADA">Completada</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Fecha inicio *">
                <input className={pdmInput}
                  type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
                />
              </Field>
              <Field label="Fecha fin *">
                <input className={pdmInput}
                  type="date"
                  value={form.fecha_fin}
                  onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))}
                />
              </Field>
              <Field label="Meta a ejecutar *">
                <input className={pdmInput}
                  type="number"
                  step="0.01"
                  min={0}
                  max={metaDisponible}
                  value={form.meta_ejecutar || ""}
                  onChange={(e) => setForm((p) => ({ ...p, meta_ejecutar: Number(e.target.value) }))}
                  placeholder={`Máx. ${metaDisponible}`}
                />
                <p className="mt-1 text-xs text-slate-500">{producto.unidad_medida}</p>
              </Field>
            </div>
          </div>
        </PdmCard>

        <PdmCard title="Evidencia de cumplimiento *">
          <div className="space-y-4">
            <PdmAlert tone="info">Obligatorio: al menos una URL externa o hasta 4 imágenes.</PdmAlert>

            <Field label="URL de evidencia externa">
              <input className={pdmInput}
                type="url"
                value={form.evidencia_url}
                onChange={(e) => setForm((p) => ({ ...p, evidencia_url: e.target.value }))}
                placeholder="https://ejemplo.com/evidencia"
              />
            </Field>

            <Field label="Imágenes (máximo 4)">
              <input
                type="file"
                accept="image/*"
                multiple
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700"
                onChange={(e) => {
                  void readImagesAsBase64(e.target.files).then((imagenes) =>
                    setForm((p) => ({ ...p, imagenes: [...p.imagenes, ...imagenes].slice(0, 4) })),
                  );
                  e.target.value = "";
                }}
              />
            </Field>

            {form.imagenes.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {form.imagenes.map((imagen, index) => (
                  <div key={`${index}-${imagen.slice(0, 16)}`} className="relative overflow-hidden rounded-lg border border-slate-200">
                    <img src={imagen} alt={`Evidencia ${index + 1}`} className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white"
                      onClick={() =>
                        setForm((p) => ({ ...p, imagenes: p.imagenes.filter((_, i) => i !== index) }))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PdmCard>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className={pdmBtnSecondary}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className={`${pdmBtnPrimary} sm:min-w-[200px]`}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                {actividadEnEdicion ? "Actualizar" : "Registrar"} evidencia
              </>
            )}
          </button>
        </div>
      </form>
    </PdmModal>
  );
}
