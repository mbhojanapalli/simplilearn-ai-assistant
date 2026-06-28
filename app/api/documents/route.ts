import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { deleteDocument, getStats, listDocuments } from "@/lib/vector";
import type { DocCategory } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

function authed(req: NextRequest): boolean {
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const [documents, stats] = await Promise.all([listDocuments(), getStats()]);
    return NextResponse.json({ documents, stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load documents.";
    return NextResponse.json({ error: msg, documents: [], stats: null }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let body: { docId?: string; category?: string };
  try {
    body = (await req.json()) as { docId?: string; category?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const docId = body.docId?.trim();
  const category = body.category as DocCategory;
  if (!docId || (category !== "academic" && category !== "support")) {
    return NextResponse.json({ error: "Missing docId or category." }, { status: 400 });
  }

  try {
    const deleted = await deleteDocument(category, docId);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete document.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
