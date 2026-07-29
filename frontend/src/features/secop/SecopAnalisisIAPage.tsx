import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { secopApi } from "@/core/api/secop";
import { useSecopYear } from "./SecopYearContext";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function SecopAnalisisIAPage() {
  const { anio } = useSecopYear();
  const [analisis, setAnalisis] = useState("");
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadAnalisis() {
    setLoadingAnalisis(true);
    try {
      const res = await secopApi.aiAnalisis(anio);
      setAnalisis(res.analisis);
    } catch {
      setAnalisis("No se pudo generar el análisis. Verifique SECOP_OPENAI_API_KEY en el servidor.");
    } finally {
      setLoadingAnalisis(false);
    }
  }

  useEffect(() => {
    loadAnalisis();
  }, [anio]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    const nextHistory = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(nextHistory);
    setSending(true);
    try {
      const res = await secopApi.aiCopilot(
        userMsg,
        anio,
        messages.map((m) => ({ role: m.role, content: m.content })),
      );
      setMessages([...nextHistory, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages([
        ...nextHistory,
        { role: "assistant", content: "Error al consultar el copiloto. Intente de nuevo." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
            <Sparkles className="h-5 w-5 text-[#3eafd4]" />
            Análisis IA — vigencia {anio}
          </h2>
          <button
            type="button"
            onClick={loadAnalisis}
            disabled={loadingAnalisis}
            className="text-sm text-[#0e7490] hover:underline disabled:opacity-50"
          >
            Regenerar
          </button>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-5">
          {loadingAnalisis ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generando análisis…
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{analisis}</div>
          )}
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#111827]">Copiloto de contratación</h2>
          <p className="text-xs text-slate-500">Pregunte sobre contratos, proveedores y alertas de su entidad</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 320 }}>
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400">
              Ej: ¿Cuáles son los principales riesgos en {anio}? ¿Quién concentra más contratos?
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "ml-auto bg-[#3eafd4] text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escriba su pregunta…"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-[#3eafd4] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d9bbf] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
