import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { TopBar } from "@/components/site/TopBar";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const metadata = {
  title: "Admin · Simplilearn AI Assistant",
};

export default function AdminPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-muted shadow-sm transition-colors hover:border-slate-300 hover:text-ink"
        >
          <MessageSquare className="h-4 w-4" />
          Open chat
        </Link>
      </TopBar>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <AdminConsole />
      </main>
    </div>
  );
}
