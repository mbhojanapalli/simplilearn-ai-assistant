import { Index } from "@upstash/vector";
import type { ChunkMetadata, DocumentSummary } from "@/lib/types";
import type { DocCategory } from "@/lib/config";

/**
 * Upstash Vector client.
 *
 * The index must be created with a BUILT-IN embedding model (e.g.
 * "BAAI/bge-base-en-v1.5") so we can upsert/query with raw `data` strings and
 * let Upstash handle embedding server-side — no separate embeddings key needed.
 *
 * We keep two namespaces so each agent only ever retrieves from its own corpus:
 *   - "academic"  → Academic Agent
 *   - "support"   → Help & Support Agent
 */

let _index: Index | null = null;

export function getIndex(): Index {
  if (_index) return _index;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Vector store is not configured. Set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN.",
    );
  }
  _index = new Index({ url, token });
  return _index;
}

export interface UpsertItem {
  id: string;
  data: string;
  metadata: ChunkMetadata;
}

/** Upsert chunks into a namespace, batching to stay within request limits. */
export async function upsertChunks(
  namespace: DocCategory,
  items: UpsertItem[],
): Promise<void> {
  const ns = getIndex().namespace(namespace);
  const BATCH = 25;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await ns.upsert(
      batch.map((it) => ({ id: it.id, data: it.data, metadata: it.metadata })),
    );
  }
}

export interface QueryHit {
  id: string;
  score: number;
  data?: string;
  metadata?: ChunkMetadata;
}

/** Semantic search within a single namespace. */
export async function queryNamespace(
  namespace: DocCategory,
  query: string,
  topK: number,
): Promise<QueryHit[]> {
  const ns = getIndex().namespace(namespace);
  const res = await ns.query({
    data: query,
    topK,
    includeMetadata: true,
    includeData: true,
  });
  return (res as QueryHit[]) ?? [];
}

/** Delete every chunk belonging to a document (chunk ids are `${docId}#${i}`). */
export async function deleteDocument(
  namespace: DocCategory,
  docId: string,
): Promise<number> {
  const ns = getIndex().namespace(namespace);
  // Primary path: prefix delete. Fall back to id-collection if unsupported.
  try {
    const res = (await ns.delete({ prefix: `${docId}#` })) as { deleted?: number };
    return res?.deleted ?? 0;
  } catch {
    const ids = await collectChunkIds(namespace, docId);
    if (ids.length === 0) return 0;
    await ns.delete(ids);
    return ids.length;
  }
}

async function collectChunkIds(
  namespace: DocCategory,
  docId: string,
): Promise<string[]> {
  const ns = getIndex().namespace(namespace);
  const ids: string[] = [];
  let cursor = "";
  do {
    const page = (await ns.range({
      cursor,
      limit: 200,
      includeMetadata: true,
    })) as { nextCursor: string; vectors: Array<{ id: string; metadata?: ChunkMetadata }> };
    for (const v of page.vectors) {
      if (v.metadata?.docId === docId) ids.push(v.id);
    }
    cursor = page.nextCursor;
  } while (cursor !== "" && cursor !== "0");
  return ids;
}

/** Aggregate all chunks across both namespaces into one document per docId. */
export async function listDocuments(): Promise<DocumentSummary[]> {
  const namespaces: DocCategory[] = ["academic", "support"];
  const byDoc = new Map<string, DocumentSummary>();

  for (const namespace of namespaces) {
    const ns = getIndex().namespace(namespace);
    let cursor = "";
    do {
      const page = (await ns.range({
        cursor,
        limit: 200,
        includeMetadata: true,
      })) as {
        nextCursor: string;
        vectors: Array<{ id: string; metadata?: ChunkMetadata }>;
      };
      for (const v of page.vectors) {
        const m = v.metadata;
        if (!m?.docId) continue;
        const existing = byDoc.get(m.docId);
        if (existing) {
          existing.chunks += 1;
        } else {
          byDoc.set(m.docId, {
            docId: m.docId,
            title: m.title ?? m.source ?? "Untitled",
            source: m.source ?? "unknown",
            category: namespace,
            chunks: 1,
            uploadedAt: m.uploadedAt ?? "",
          });
        }
      }
      cursor = page.nextCursor;
    } while (cursor !== "" && cursor !== "0");
  }

  return Array.from(byDoc.values()).sort((a, b) =>
    (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""),
  );
}

export interface VectorStats {
  academic: number;
  support: number;
  total: number;
}

/** Per-namespace vector counts for the admin dashboard. */
export async function getStats(): Promise<VectorStats> {
  const info = (await getIndex().info()) as {
    namespaces?: Record<string, { vectorCount?: number }>;
  };
  const academic = info.namespaces?.["academic"]?.vectorCount ?? 0;
  const support = info.namespaces?.["support"]?.vectorCount ?? 0;
  return { academic, support, total: academic + support };
}
