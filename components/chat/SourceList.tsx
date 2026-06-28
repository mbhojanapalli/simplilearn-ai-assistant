import { FileText } from "lucide-react";
import type { RetrievedSource } from "@/lib/types";

/** Renders the grounding sources cited in an answer as numbered chips. */
export function SourceList({ sources }: { sources: RetrievedSource[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        <FileText className="h-3.5 w-3.5" />
        Sources
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <span
            key={s.id}
            title={`${s.title} · relevance ${(s.score * 100).toFixed(0)}%`}
            className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-ink-muted shadow-sm"
          >
            <span className="grid h-4 w-4 flex-none place-items-center rounded bg-brand-50 text-[10px] font-bold text-brand-700">
              {s.index}
            </span>
            <span className="truncate">{s.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
