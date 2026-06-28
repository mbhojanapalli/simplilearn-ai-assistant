import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { extractTextFromFile } from "@/lib/extract";
import { chunkText } from "@/lib/chunk";
import { upsertChunks, type UpsertItem } from "@/lib/vector";
import type { ChunkMetadata } from "@/lib/types";
import type { DocCategory } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const VALID_CATEGORIES: DocCategory[] = ["academic", "support"];

export async function POST(req: NextRequest) {
  if (!verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a file or text." },
      { status: 400 },
    );
  }

  const category = String(form.get("category") ?? "") as DocCategory;
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: "Invalid category. Choose 'academic' or 'support'." },
      { status: 400 },
    );
  }

  const title = String(form.get("title") ?? "").trim();
  const file = form.get("file");
  const pastedText = String(form.get("text") ?? "").trim();

  let rawText = "";
  let source = "";

  try {
    if (file && file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 10 MB." },
          { status: 413 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      source = file.name;
      rawText = await extractTextFromFile(file.name, buffer);
    } else if (pastedText) {
      rawText = pastedText;
      source = title ? `${slugify(title)}.txt` : "pasted-note.txt";
    } else {
      return NextResponse.json(
        { error: "Provide a file or paste some text to upload." },
        { status: 400 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the document." },
      { status: 400 },
    );
  }

  const cleanText = rawText.trim();
  // Count non-whitespace characters only, to detect effectively-empty documents.
  if (cleanText.replace(/\s+/g, "").length < 20) {
    return NextResponse.json(
      { error: "The document appears to be empty or unreadable." },
      { status: 400 },
    );
  }

  const chunks = chunkText(cleanText);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "No content to index." }, { status: 400 });
  }

  const docId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  const docTitle = title || source.replace(/\.[^.]+$/, "");

  const items: UpsertItem[] = chunks.map((text, i) => {
    const metadata: ChunkMetadata = {
      docId,
      title: docTitle,
      source,
      category,
      chunkIndex: i,
      totalChunks: chunks.length,
      uploadedAt,
      snippet: text.replace(/\s+/g, " ").trim().slice(0, 200),
    };
    return { id: `${docId}#${i}`, data: text, metadata };
  });

  try {
    await upsertChunks(category, items);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to store vectors.";
    const friendly = msg.toLowerCase().includes("vector store")
      ? "The vector database isn't configured. Set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN."
      : msg;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    document: {
      docId,
      title: docTitle,
      source,
      category,
      chunks: chunks.length,
      characters: cleanText.length,
      uploadedAt,
    },
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
