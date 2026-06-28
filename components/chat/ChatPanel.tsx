"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, GraduationCap, LifeBuoy } from "lucide-react";
import type { AgentKey } from "@/lib/config";
import type { ChatMessage, ChatStreamEvent } from "@/lib/types";
import { MessageBubble, type UIMessage } from "@/components/chat/MessageBubble";
import { cn } from "@/lib/utils";

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
          body: JSON.stringify({ messages: payload }),
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
    [isStreaming, patch],
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
      <div
        ref={scrollRef}
        className="scrollbar-slim flex-1 overflow-y-auto py-6"
      >
        {isEmpty ? (
          <EmptyState onPick={(t) => void send(t)} disabled={isStreaming} />
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
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lift focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-50">
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask about a concept, an assignment, your certificate, payments…"
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
          Simplilearn AI Assistant routes your question to the right specialist
          agent and answers from your knowledge base. It can make mistakes —
          verify important details.
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (text: string) => void;
  disabled: boolean;
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
        Ask anything about your course or your account. I&apos;ll route you to
        the right specialist and answer from Simplilearn&apos;s knowledge base.
      </p>

      {/* Capability cards */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <CapabilityCard
          icon={<GraduationCap className="h-4 w-4" />}
          tone="academic"
          title="Academic Agent"
          desc="Concepts, assignments, projects, quizzes & study guidance."
        />
        <CapabilityCard
          icon={<LifeBuoy className="h-4 w-4" />}
          tone="support"
          title="Help & Support Agent"
          desc="Certificates, schedules, access, payments, refunds & FAQs."
        />
      </div>

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
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "academic" | "support";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-soft">
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
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{desc}</p>
    </div>
  );
}
