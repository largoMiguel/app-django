import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { authApi } from "@/core/auth/api";
import { useAuthStore } from "@/core/auth/store";
import { formatApiError } from "@/core/api/errors";

interface Props {
  /** Mostrar abierto por defecto si no hay firma configurada */
  defaultOpen?: boolean;
  compact?: boolean;
  /** Pestaña dedicada en el detalle PQRS (sin acordeón) */
  variant?: "inline" | "tab";
}

export default function EmailFirmaPanel({
  defaultOpen = false,
  compact = false,
  variant = "inline",
}: Props) {
  const { user, setUser } = useAuthStore();
  const isTab = variant === "tab";
  const [open, setOpen] = useState(isTab || defaultOpen);
  const [firma, setFirma] = useState(user?.email_firma ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setFirma(user?.email_firma ?? "");
  }, [user?.email_firma]);

  useEffect(() => {
    if (isTab) {
      setOpen(true);
      return;
    }
    if (!user?.email_firma?.trim()) {
      setOpen(true);
    } else if (defaultOpen) {
      setOpen(true);
    }
  }, [user?.email_firma, defaultOpen, isTab]);

  async function guardar() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const updated = await authApi.updateMe({ email_firma: firma });
      setUser(updated);
      setSaved(true);
    } catch (e) {
      setErr(formatApiError(e, "No se pudo guardar la firma."));
    } finally {
      setBusy(false);
    }
  }

  const preview = firma.trim();

  const editor = (
    <div className={`space-y-3 ${isTab ? "" : "border-t border-slate-200 px-3 py-3"}`}>
      <p className="text-xs text-slate-600">
        Como en Gmail: este texto se agrega al final de cada respuesta enviada por correo al
        ciudadano.
      </p>
      <textarea
        value={firma}
        onChange={(e) => {
          setFirma(e.target.value);
          setSaved(false);
        }}
        rows={isTab ? 6 : compact ? 3 : 4}
        placeholder={
          "Ej:\nMaría Pérez\nSecretaría de Gobierno\nAlcaldía de Ejemplo\ntel. (608) 123 4567"
        }
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
      />
      {preview && (
        <div>
          <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
            Vista previa
          </span>
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
            <div className="mb-2 text-xs text-slate-500">…texto de su respuesta…</div>
            <div>{preview}</div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={guardar}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1c2536] px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {busy ? "Guardando…" : "Guardar firma"}
        </button>
        {saved && <span className="text-xs text-emerald-600">Guardada</span>}
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );

  if (isTab) {
    return (
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-200 pb-1.5">
          Firma de correo
        </h3>
        {editor}
      </section>
    );
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
      >
        <span className="font-medium text-slate-800">Firma de correo</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {preview ? "Configurada" : "Sin configurar"}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && editor}
    </div>
  );
}
