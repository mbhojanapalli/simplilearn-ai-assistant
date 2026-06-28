/**
 * Seed the Upstash Vector knowledge base with the sample documents.
 *
 * Usage:
 *   1) Fill in .env.local (ANTHROPIC_API_KEY not required for seeding; you need
 *      UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN, and the index must
 *      be created with a built-in embedding model).
 *   2) npm run seed
 *
 * This script is intentionally self-contained (no app path aliases) so it runs
 * reliably under `tsx` without extra configuration.
 */

import { Index } from "@upstash/vector";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Minimal .env loader (.env.local then .env; never overrides existing vars) ──
function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const path = join(process.cwd(), name);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

// ── Chunking (mirrors lib/chunk.ts) ──
function chunkText(text: string, chunkSize = 1100, overlap = 150): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const blocks = normalized.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = overlap > 0 && trimmed.length > overlap ? trimmed.slice(-overlap) + "\n\n" : "";
  };
  for (const block of blocks) {
    if (block.length > chunkSize) {
      if (current.trim()) flush();
      for (let i = 0; i < block.length; i += chunkSize - overlap) {
        chunks.push(block.slice(i, i + chunkSize).trim());
      }
      current = "";
      continue;
    }
    if ((current + "\n\n" + block).length > chunkSize) flush();
    current += (current ? "\n\n" : "") + block;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}

async function main() {
  loadEnv();

  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    console.error(
      "\n✗ Missing UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN.\n" +
        "  Add them to .env.local (and create the index with a built-in embedding model).\n",
    );
    process.exit(1);
  }

  const index = new Index({ url, token });
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = join(__dirname, "..", "sample-documents");

  const categories: Array<"academic" | "support"> = ["academic", "support"];
  let totalDocs = 0;
  let totalChunks = 0;

  for (const category of categories) {
    const dir = join(root, category);
    if (!existsSync(dir)) {
      console.warn(`(skip) no folder: ${dir}`);
      continue;
    }
    const files = readdirSync(dir).filter((f) => /\.(md|markdown|txt)$/i.test(f));

    for (const filename of files) {
      const raw = readFileSync(join(dir, filename), "utf-8").trim();
      const chunks = chunkText(raw);
      if (chunks.length === 0) continue;

      const docId = randomUUID();
      const uploadedAt = new Date().toISOString();
      const title = filename
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const items = chunks.map((text, i) => ({
        id: `${docId}#${i}`,
        data: text,
        metadata: {
          docId,
          title,
          source: filename,
          category,
          chunkIndex: i,
          totalChunks: chunks.length,
          uploadedAt,
          snippet: text.replace(/\s+/g, " ").trim().slice(0, 200),
        },
      }));

      const ns = index.namespace(category);
      const BATCH = 25;
      for (let i = 0; i < items.length; i += BATCH) {
        await ns.upsert(items.slice(i, i + BATCH));
      }

      totalDocs += 1;
      totalChunks += chunks.length;
      console.log(`  ✓ [${category}] ${filename} → ${chunks.length} chunks`);
    }
  }

  console.log(
    `\n✓ Done. Seeded ${totalDocs} documents (${totalChunks} chunks) into Upstash Vector.\n`,
  );
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err?.message ?? err, "\n");
  process.exit(1);
});
