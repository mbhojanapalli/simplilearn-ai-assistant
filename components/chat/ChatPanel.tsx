"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, GraduationCap, LifeBuoy, Sparkles } from "lucide-react";
import type { AgentKey } from "@/lib/config";
import type { ChatMessage, ChatStreamEvent } from "@/lib/types";
import { MessageBubble, type UIMessage } from "@/components/chat/MessageBubble";
import { cn } from "@/lib/utils";

/** "auto" lets the router decide; academic/support force a specific agent. */
type Mode = "auto" | "academic" | "support";

const SUGGESTIONS: { agent: AgentKey; text: string }[] = [
  { agent: "academic", text: "Explain overfitting in simple terms." },
  { agent: "academic", text: "I'm stuck on my assignment. Can you guide me?" },
  { agent: "support", text: "When will I receive my certificate?" },
  { agent: "support", text: "I can't access my live class." },
  { agent: "support", text: "What is the refund policy?" },
];

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function ChatPanel() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");

  const messagesRef = useRef<UIMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const selectMode = useCallback((m: Mode) => {
    setMode(m);
    taRef.current?.focus();
  }, []);

  const patch = useCallback((id: string, fn: (m: UIMessage) => UIMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const history: ChatMessage[] = messagesRef.current
        .filter((m) => m.state !== "error" && m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content }));
      const payload: ChatMessage[] = [...history, { role: "user", content: trimmed }];

      const userMsg: UIMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        state: "done",
      };
      const assistantId = uid();
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        state: "streaming",
        status: "Understanding your question…",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // When a specific agent is selected, send it so the server skips routing.
          body: JSON.stringify({
            messages: payload,
            agent: mode === "auto" ? undefined : mode,
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handle = (evt: ChatStreamEvent) => {
          switch (evt.type) {
            case "status":
              patch(assistantId, (m) => ({ ...m, status: evt.value }));
              break;
            case "meta":
              patch(assistantId, (m) => ({
                ...m,
                agent: evt.agent,
                route: evt.route,
                sources: evt.sources,
              }));
              break;
            case "delta":
              patch(assistantId, (m) => ({
                ...m,
                content: m.content + evt.value,
                status: undefined,
              }));
              break;
            case "done":
              patch(assistantId, (m) => ({ ...m, state: "done" }));
              break;
            case "error":
              patch(assistantId, (m) => ({
                ...m,
                state: "error",
                error: evt.value,
              }));
              break;
          }
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            try {
              handle(JSON.parse(line) as ChatStreamEvent);
            } catch {
              /* ignore malformed line */
            }
          }
        }
        const tail = buffer.trim();
        if (tail) {
          try {
            handle(JSON.parse(tail) as ChatStreamEvent);
          } catch {
            /* ignore */
          }
        }

        patch(assistantId, (m) =>
          m.state === "streaming" ? { ...m, state: "done" } : m,
        );
      } catch (err) {
        patch(assistantId, (m) => ({
          ...m,
          state: "error",
          error:
            err instanceof Error
              ? err.message
              : "Network error — please try again.",
        }));
      } finally {
        setIsStreaming(false);
        taRef.current?.focus();
      }
    },
    [isStreaming, patch, mode],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col px-4 sm:px-6">
      {/* Conversation / empty state */}
      <div ref={scrollRef} className="scrollbar-slim flex-1 overflow-y-auto py-6">
        {isEmpty ? (
          <EmptyState
            onPick={(t) => void send(t)}
            disabled={isStreaming}
            mode={mode}
            onSelectMode={selectMode}
          />
        ) : (
          <div className="space-y-6 pb-2">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="pb-4 pt-2">
        {/* Agent selector — overrides the router */}
        <div className="mb-2 flex justify-center">
          <AgentSelector mode={mode} onSelect={selectMode} disabled={isStreaming} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lift focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-50">
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                mode === "academic"
                  ? "Ask the Academic agent about a concept, assignment or project…"
                  : mode === "support"
                    ? "Ask the Help & Support agent about certificates, payments, access…"
                    : "Ask about a concept, an assignment, your certificate, payments…"
              }
              className="scrollbar-slim max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={isStreaming || input.trim().length === 0}
              aria-label="Send message"
              className={cn(
                "grid h-10 w-10 flex-none place-items-center rounded-xl text-white transition-all",
                isStreaming || input.trim().length === 0
                  ? "cursor-not-allowed bg-slate-300"
                  : "bg-brand-600 hover:bg-brand-700 active:scale-95",
              )}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          {mode === "auto"
            ? "Auto-route: the assistant picks the right specialist agent for each question."
            : `Locked to the ${mode === "academic" ? "Academic" : "Help & Support"} agent — switch to Auto-route to let it choose.`}{" "}
          Answers come from your knowledge base and can make mistakes — verify important details.
        </p>
      </div>
    </div>
  );
}

/** Segmented control to pick the answering agent. */
function AgentSelector({
  mode,
  onSelect,
  disabled,
}: {
  mode: Mode;
  onSelect: (m: Mode) => void;
  disabled: boolean;
}) {
  const options: {
    key: Mode;
    label: string;
    icon: typeof Sparkles;
    active: string;
  }[] = [
    { key: "auto", label: "Auto-route", icon: Sparkles, active: "bg-white text-brand-700 ring-brand-200" },
    { key: "academic", label: "Academic", icon: GraduationCap, active: "bg-white text-indigo-700 ring-indigo-200" },
    { key: "support", label: "Help & Support", icon: LifeBuoy, active: "bg-white text-teal-700 ring-teal-200" },
  ];
  return (
    <div
      role="group"
      aria-label="Choose answering agent"
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100/80 p-1"
    >
      {options.map((o) => {
        const Icon = o.icon;
        const isActive = mode === o.key;
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(o.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60",
              isActive
                ? `shadow-sm ring-1 ring-inset ${o.active}`
                : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
  mode,
  onSelectMode,
}: {
  onPick: (text: string) => void;
  disabled: boolean;
  mode: Mode;
  onSelectMode: (m: Mode) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl animate-fade-up py-6 text-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-ink-muted shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
        </span>
        Multi-agent · Retrieval-augmented
      </div>

      <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
        How can I help you learn today?
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[0.95rem] text-ink-muted">
        Ask anything about your course or your account. I&apos;ll route you to the
        right specialist — or pick an agent below to answer with it directly.
      </p>

      {/* Capability cards — click to lock the answering agent */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <CapabilityCard
          icon={<GraduationCap className="h-4 w-4" />}
          tone="academic"
          title="Academic Agent"
          desc="Concepts, assignments, projects, quizzes & study guidance."
          active={mode === "academic"}
          onClick={() => onSelectMode(mode === "academic" ? "auto" : "academic")}
        />
        <CapabilityCard
          icon={<LifeBuoy className="h-4 w-4" />}
          tone="support"
          title="Help & Support Agent"
          desc="Certificates, schedules, access, payments, refunds & FAQs."
          active={mode === "support"}
          onClick={() => onSelectMode(mode === "support" ? "auto" : "support")}
        />
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        {mode === "auto"
          ? "Tip: click an agent to answer with it directly, or just ask and it'll auto-route."
          : `Locked to the ${mode === "academic" ? "Academic" : "Help & Support"} agent. Click it again to return to auto-routing.`}
      </p>

      {/* Suggested prompts */}
      <div className="mt-7">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Try asking
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              type="button"
              disabled={disabled}
              onClick={() => onPick(s.text)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-50",
                s.agent === "academic"
                  ? "border-indigo-200 bg-academic-soft text-indigo-700 hover:bg-indigo-100"
                  : "border-teal-200 bg-support-soft text-teal-700 hover:bg-teal-100",
              )}
            >
              {s.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapabilityCard({
  icon,
  title,
  desc,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "academic" | "support";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border bg-white p-4 text-left shadow-soft transition-all hover:shadow-lift",
        active
          ? tone === "academic"
            ? "border-indigo-300 ring-2 ring-indigo-200"
            : "border-teal-300 ring-2 ring-teal-200"
          : "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-lg",
              tone === "academic"
                ? "bg-academic-soft text-indigo-600"
                : "bg-support-soft text-teal-600",
            )}
          >
            {icon}
          </span>
          <span className="text-sm font-semibold text-ink">{title}</span>
        </div>
        {active && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              tone === "academic"
                ? "bg-academic-soft text-indigo-700"
                : "bg-support-soft text-teal-700",
            )}
          >
            Selected
          </span>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{desc}</p>
    </button>
  );
}
