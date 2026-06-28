"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Database,
  FileText,
  GraduationCap,
  LifeBuoy,
  Loader2,
  LogOut,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/config";
import type { DocumentSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface Stats {
  academic: number;
  support: number;
  total: number;
}

type Toast = { type: "success" | "error"; msg: string } | null;

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx";

export function AdminConsole() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [category, setCategory] = useState<DocCategory>("academic");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const flash = useCallback((t: Toast) => {
    setToast(t);
    if (t) window.setTimeout(() => setToast(null), 4000);
  }, []);

  const loadDocuments = useCallback(async () => {
    const res = await fetch("/api/documents", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setDocuments(Array.isArray(data.documents) ? data.documents : []);
    setStats(data.stats ?? null);
  }, [router]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data.configured) {
        setUnconfigured(true);
        setReady(true);
        return;
      }
      if (!data.authenticated) {
        router.replace("/admin/login");
        return;
      }
      await loadDocuments();
      setReady(true);
    })();
  }, [router, loadDocuments]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    if (mode === "file" && !file) {
      flash({ type: "error", msg: "Choose a file to upload." });
      return;
    }
    if (mode === "text" && text.trim().length < 20) {
      flash({ type: "error", msg: "Paste at least a short paragraph of text." });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("category", category);
      if (title.trim()) form.set("title", title.trim());
      if (mode === "file" && file) form.set("file", file);
      if (mode === "text") form.set("text", text.trim());

      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok || !data.ok) {
        flash({ type: "error", msg: data.error ?? "Upload failed." });
        return;
      }
      flash({
        type: "success",
        msg: `Indexed "${data.document.title}" — ${data.document.chunks} chunks embedded.`,
      });
      setFile(null);
      setText("");
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDocuments();
    } catch {
      flash({ type: "error", msg: "Network error during upload." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: DocumentSummary) {
    if (deletingId) return;
    setDeletingId(doc.docId);
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.docId, category: doc.category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        flash({ type: "error", msg: data.error ?? "Delete failed." });
        return;
      }
      flash({ type: "success", msg: `Removed "${doc.title}".` });
      await loadDocuments();
    } catch {
      flash({ type: "error", msg: "Network error during delete." });
    } finally {
      setDeletingId(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setMode("file");
      setFile(dropped);
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-muted">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading console…
      </div>
    );
  }

  if (unconfigured) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        <h2 className="text-base font-semibold">Admin access isn&apos;t configured</h2>
        <p className="mt-2 text-sm">
          Set the <code className="rounded bg-amber-100 px-1">ADMIN_PASSWORD</code>{" "}
          environment variable in your Vercel project (or{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> locally),
          then redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Knowledge Base
          </h1>
          <p className="text-sm text-ink-muted">
            Upload course material and support docs. They&apos;re chunked,
            embedded, and stored for retrieval.
          </p>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-muted shadow-sm transition-colors hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Documents"
          value={documents.length}
          icon={<FileText className="h-4 w-4" />}
          tint="bg-slate-100 text-slate-600"
        />
        <StatCard
          label="Total chunks"
          value={stats?.total ?? 0}
          icon={<Database className="h-4 w-4" />}
          tint="bg-brand-50 text-brand-600"
        />
        <StatCard
          label="Academic"
          value={stats?.academic ?? 0}
          icon={<GraduationCap className="h-4 w-4" />}
          tint="bg-academic-soft text-indigo-600"
        />
        <StatCard
          label="Support"
          value={stats?.support ?? 0}
          icon={<LifeBuoy className="h-4 w-4" />}
          tint="bg-support-soft text-teal-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Upload */}
        <form
          onSubmit={handleUpload}
          className="lg:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-ink">Add a document</h2>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DOC_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    category === c.value
                      ? c.value === "academic"
                        ? "border-indigo-300 bg-academic-soft text-indigo-700"
                        : "border-teal-300 bg-support-soft text-teal-700"
                      : "border-slate-200 bg-white text-ink-muted hover:border-slate-300",
                  )}
                >
                  <div className="font-medium">{c.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {DOC_CATEGORIES.find((c) => c.value === category)?.hint}
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Title <span className="text-ink-faint">(optional)</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Refund Policy 2025"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50"
            />
          </div>

          {/* Mode toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            {(["file", "text"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium capitalize transition-colors",
                  mode === m ? "bg-white text-ink shadow-sm" : "text-ink-muted",
                )}
              >
                {m === "file" ? "Upload file" : "Paste text"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors",
                dragging
                  ? "border-brand-400 bg-brand-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-2 text-sm text-ink">
                  <FileText className="h-4 w-4 text-brand-600" />
                  <span className="max-w-[200px] truncate font-medium">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded p-0.5 text-ink-faint hover:text-rose-500"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-5 w-5 text-ink-faint" />
                  <p className="text-sm text-ink-muted">
                    Drag &amp; drop, or{" "}
                    <span className="font-medium text-brand-600">browse</span>
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    PDF, DOCX, TXT, or Markdown · up to 10 MB
                  </p>
                </>
              )}
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste FAQ answers, policy text, or course notes…"
              className="scrollbar-slim w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50"
            />
          )}

          <button
            type="submit"
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing &amp; embedding…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Process &amp; index
              </>
            )}
          </button>
        </form>

        {/* Document list */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Indexed documents</h2>
            <span className="text-xs text-ink-faint">{documents.length} total</span>
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-ink-faint">
                <Database className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-ink">No documents yet</p>
              <p className="mt-1 max-w-xs text-xs text-ink-muted">
                Upload your first document, or run the seed script to load the
                sample knowledge base.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <li
                  key={doc.docId}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 flex-none place-items-center rounded-lg",
                      doc.category === "academic"
                        ? "bg-academic-soft text-indigo-600"
                        : "bg-support-soft text-teal-600",
                    )}
                  >
                    {doc.category === "academic" ? (
                      <GraduationCap className="h-4 w-4" />
                    ) : (
                      <LifeBuoy className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {doc.title}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
                      <span className="truncate">{doc.source}</span>
                      <span>·</span>
                      <span>{doc.chunks} chunks</span>
                      {doc.uploadedAt && (
                        <>
                          <span>·</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.docId}
                    className="grid h-8 w-8 flex-none place-items-center rounded-lg text-ink-faint transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                    aria-label={`Delete ${doc.title}`}
                  >
                    {deletingId === doc.docId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lift",
            toast.type === "success"
              ? "bg-ink text-white"
              : "bg-rose-600 text-white",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className={cn("grid h-7 w-7 place-items-center rounded-lg", tint)}>
          {icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
