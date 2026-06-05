import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Bot,
  ExternalLink,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import {
  pdmChatPublicApi,
  type PdmChatInfo,
  type PdmChatSource,
} from "@/core/api/pdmChatPublic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: PdmChatSource[];
}

function formatReply(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function PublicPdmChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const embed = searchParams.get("embed") === "1";

  const [info, setInfo] = useState<PdmChatInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!slug) return;
    setLoadingInfo(true);
    setInfoError(null);
    pdmChatPublicApi
      .getInfo(slug)
      .then((data) => {
        setInfo(data);
        setMessages([{ role: "assistant", content: data.intro }]);
      })
      .catch((err) => {
        const detail =
          err?.response?.data?.detail ||
          "El chat no está disponible para esta entidad.";
        setInfoError(typeof detail === "string" ? detail : "Chat no disponible.");
      })
      .finally(() => setLoadingInfo(false));
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || !slug || sending) return;

    setInput("");
    setSendError(null);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setSending(true);

    try {
      const res = await pdmChatPublicApi.sendMessage(slug, {
        message: msg,
        conversation_id: conversationId,
      });
      setConversationId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, sources: res.sources },
      ]);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "No se pudo procesar tu consulta. Intenta de nuevo.";
      setSendError(typeof detail === "string" ? detail : "Error al enviar.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (loadingInfo) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 ${embed ? "h-screen" : "min-h-screen"}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando asistente PDM…
        </div>
      </div>
    );
  }

  if (infoError || !info) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 p-6 ${embed ? "h-screen" : "min-h-screen"}`}>
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-lg font-semibold text-slate-800">Chat no disponible</h1>
          <p className="mt-2 text-sm text-slate-500">{infoError}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-slate-50 ${embed ? "h-screen" : "min-h-screen"}`}
    >
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {info.logo_url ? (
            <img
              src={info.logo_url}
              alt={info.name}
              className="h-10 w-10 rounded-full border border-slate-200 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e0f7fc]">
              <Bot className="h-5 w-5 text-[#0e7490]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-slate-800">
              Asistente PDM — {info.name}
            </h1>
            <p className="truncate text-xs text-slate-500">
              {info.plan_name || "Plan de Desarrollo Municipal"} · Consulta en tiempo real
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700">
            <Sparkles className="h-3 w-3" />
            IA
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user" ? "bg-[#3eafd4]" : "bg-slate-200"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5 text-white" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-slate-600" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#3eafd4] text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                }`}
              >
                <div className="whitespace-pre-wrap">{formatReply(msg.content)}</div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                      Fuentes
                    </p>
                    <ul className="space-y-1">
                      {msg.sources.map((src, si) => (
                        <li key={si} className="text-xs">
                          {src.url ? (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#0e7490] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              {src.titulo}
                            </a>
                          ) : (
                            <span className="text-slate-600">{src.titulo}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200">
                <Bot className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando el PDM…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestions (only when no user messages yet) */}
      {messages.length <= 1 && info.sugerencias.length > 0 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            {info.sugerencias.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void send(s)}
                disabled={sending}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-[#3eafd4] hover:text-[#0e7490] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {sendError && (
            <p className="mb-2 text-xs text-red-600">{sendError}</p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre el Plan de Desarrollo Municipal…"
              rows={1}
              disabled={sending}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#3eafd4] focus:outline-none focus:ring-1 focus:ring-[#3eafd4] disabled:bg-slate-50"
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3eafd4] text-white transition hover:bg-[#2f9fc2] disabled:opacity-50"
              title="Enviar"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[0.65rem] text-slate-400">
            Respuestas basadas en datos oficiales del PDM en tiempo real · Solo información de {info.name}
          </p>
        </div>
      </div>
    </div>
  );
}
