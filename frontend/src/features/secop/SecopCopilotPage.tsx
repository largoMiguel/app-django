import { useEffect, useRef, useState } from "react";
import { Copy, Loader2, Send, Sparkles } from "lucide-react";
import { secopApi, type SecopChartSpec, type SecopRecord } from "@/core/api/secop";
import { useSecopYear } from "./SecopYearContext";
import { DynamicChart, MarkdownContent } from "./components";
import SecopDetalleModal from "./SecopDetalleModal";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  chart?: SecopChartSpec | null;
  registros?: Partial<SecopRecord>[];
}

const SUGGESTIONS = [
  "¿Cuáles son los principales riesgos?",
  "Muéstrame un gráfico por modalidad de contratación",
  "Contratos por vencer en 30 días",
  "¿Quién concentra más contratos?",
  "Pagos realizados este año",
];

export default function SecopCopilotPage() {
  const { anio } = useSecopYear();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<SecopRecord | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e?: React.FormEvent, preset?: string) {
    e?.preventDefault();
    const userMsg = (preset || input).trim();
    if (!userMsg || sending) return;
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
      setMessages([
        ...nextHistory,
        {
          role: "assistant",
          content: res.reply,
          chart: res.chart,
          registros: res.registros,
        },
      ]);
    } catch {
      setMessages([
        ...nextHistory,
        { role: "assistant", content: "Error al consultar el copiloto. Intente de nuevo." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function openRegistro(reg: Partial<SecopRecord>) {
    if (reg.id && reg.fuente) {
      setSelected(reg as SecopRecord);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[480px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
          <Sparkles className="h-5 w-5 text-[#3eafd4]" />
          Copiloto de contratación
        </h2>
        <p className="text-xs text-slate-500">Pregunte sobre contratos, proveedores, pagos y alertas — vigencia {anio}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-slate-400">Ejemplos de preguntas:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(undefined, s)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 hover:border-[#3eafd4] hover:bg-[#3eafd4]/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-[#3eafd4] text-white"
                  : "border border-slate-100 bg-slate-50 text-slate-800"
              }`}
            >
              {m.role === "assistant" ? (
                <MarkdownContent content={m.content} className="prose-invert-0" />
              ) : (
                <p className="text-sm">{m.content}</p>
              )}

              {m.chart && m.chart.datos?.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg bg-white">
                  <DynamicChart spec={m.chart} />
                </div>
              )}

              {m.registros && m.registros.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.registros.slice(0, 6).map((reg) => (
                    <button
                      key={`${reg.fuente}-${reg.id}`}
                      type="button"
                      onClick={() => openRegistro(reg)}
                      className="rounded-md bg-white px-2 py-1 text-xs font-medium text-[#0e7490] shadow-sm hover:bg-[#3eafd4]/10"
                    >
                      {reg.referencia}
                    </button>
                  ))}
                </div>
              )}

              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(m.content)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                >
                  <Copy className="h-3 w-3" />
                  Copiar
                </button>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando datos abiertos…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escriba su pregunta…"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4]"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-[#3eafd4] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2d9bbf] disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {selected && (
        <SecopDetalleModal record={selected} anio={anio} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
