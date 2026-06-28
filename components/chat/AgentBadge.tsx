import { GraduationCap, LifeBuoy, Sparkles } from "lucide-react";
import type { AgentKey } from "@/lib/config";
import { cn } from "@/lib/utils";

const STYLES: Record<
  AgentKey,
  { label: string; icon: typeof GraduationCap; className: string; dot: string }
> = {
  academic: {
    label: "Academic Agent",
    icon: GraduationCap,
    className: "bg-academic-soft text-indigo-700 ring-indigo-200",
    dot: "bg-indigo-500",
  },
  support: {
    label: "Help & Support Agent",
    icon: LifeBuoy,
    className: "bg-support-soft text-teal-700 ring-teal-200",
    dot: "bg-teal-500",
  },
  other: {
    label: "Assistant",
    icon: Sparkles,
    className: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
  },
};

export function AgentBadge({
  agent,
  className,
}: {
  agent: AgentKey;
  className?: string;
}) {
  const s = STYLES[agent];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        s.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

export { STYLES as AGENT_STYLES };
