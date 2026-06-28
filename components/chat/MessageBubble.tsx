import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Loader2 } from "lucide-react";
import type { AgentKey } from "@/lib/config";
import type { RetrievedSource, RouteDecision } from "@/lib/types";
import { AgentBadge } from "@/components/chat/AgentBadge";
import { SourceList } from "@/components/chat/SourceList";
import { BrandMark } from "@/components/site/BrandMark";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: AgentKey;
  route?: RouteDecision;
  sources?: RetrievedSource[];
  status?: string;
  state: "streaming" | "done" | "error";
  error?: string;
}

export function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex animate-fade-up justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[0.95rem] leading-relaxed text-white shadow-soft sm:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  const showThinking = message.state === "streaming" && message.content.length === 0;

  return (
    <div className="flex animate-fade-up gap-3">
      <div className="mt-0.5 flex-none">
        <BrandMark showText={false} size="sm" />
      </div>

      <div className="min-w-0 flex-1">
        {message.agent && (
          <div className="mb-1.5 flex items-center gap-2">
            <AgentBadge agent={message.agent} />
            {message.route && message.route.confidence > 0 && (
              <span className="hidden text-[11px] text-ink-faint sm:inline">
                routed · {(message.route.confidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>
        )}

        <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-soft">
          {showThinking ? (
            <ThinkingIndicator status={message.status} />
          ) : message.state === "error" ? (
            <div className="flex items-start gap-2 text-sm text-rose-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{message.error ?? "Something went wrong."}</span>
            </div>
          ) : (
            <>
              <div className="prose-chat">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
                {message.state === "streaming" && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-blink bg-brand-500 align-middle" />
                )}
              </div>
              {message.sources && message.sources.length > 0 && (
                <SourceList sources={message.sources} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingIndicator({ status }: { status?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
      <span>{status ?? "Thinking…"}</span>
    </div>
  );
}
