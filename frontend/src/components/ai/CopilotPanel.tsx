import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Bot } from "lucide-react";
import { pdmAiApi } from "@/core/api/ai/pdm";
import { pqrsAiApi } from "@/core/api/ai/pqrs";
import { formatApiError } from "@/core/api/errors";
import {
  type CopilotModuleKey,
  copilotModulesLabel,
} from "@/core/ai/copilot";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<Record<string, unknown>>;
}

interface Props {
  mode: "pdm" | "global";
  modules?: CopilotModuleKey[];
  title?: string;
  onClose?: () => void;
  className?: string;
}

function copilotHint(modules: CopilotModuleKey[], mode: "pdm" | "global"): string {
  if (mode === "pdm" || (modules.length === 1 && modules[0] === "pdm")) {
    return "Pregunta sobre el Plan de Desarrollo Municipal";
  }
  if (modules.length === 1 && modules[0] === "pqrs") {
    return "Pregunta sobre PQRS, SLA y cumplimiento";
  }
  return `Pregunta sobre ${copilotModulesLabel(modules)}`;
}

function exampleQuestion(modules: CopilotModuleKey[], mode: "pdm" | "global"): string {
  if (mode === "pdm" || (modules.length === 1 && modules[0] === "pdm")) {
    return "¿Qué productos están en riesgo?";
  }
  if (modules.length === 1 && modules[0] === "pqrs") {
    return "¿Cuáles PQRS están por vencer?";
  }
  return "¿Hay quejas relacionadas con productos atrasados?";
}

export default function CopilotPanel({
  mode,
  modules = ["pqrs", "pdm"],
  title = "Copiloto IA",
  onClose,
  className = "",
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const fn = mode === "pdm" ? pdmAiApi.copilot : pqrsAiApi.globalCopilot;
      const res = await fn(text, conversationId);
      setConversationId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, sources: res.sources },
      ]);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex flex-col bg-white border border-slate-200 rounded-xl shadow-lg ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-5 h-5 text-blue-600 shrink-0" />
          <span className="font-medium text-slate-800 truncate">{title}</span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {modules.length > 0 && (
        <p className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
          Módulos: {copilotModulesLabel(modules)}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px]">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-blue-300" />
            <p>{copilotHint(modules, mode)}</p>
            <p className="text-xs mt-1">Ej: {exampleQuestion(modules, mode)}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <p className="text-xs mt-2 opacity-60">
                  Fuentes: {msg.sources.length} consulta(s)
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-500">
              Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-red-500 px-4">{error}</p>}

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Escribe tu pregunta..."
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
