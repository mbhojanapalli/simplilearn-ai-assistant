import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { TopBar } from "@/components/site/TopBar";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-muted shadow-sm transition-colors hover:border-slate-300 hover:text-ink"
        >
          <ShieldCheck className="h-4 w-4" />
          Admin
        </Link>
      </TopBar>
      <main className="flex-1">
        <ChatPanel />
      </main>
    </div>
  );
}
