import { AGENTS, RETRIEVAL, type AgentKey, type DocCategory } from "@/lib/config";
import { queryNamespace } from "@/lib/vector";
import type { RetrievedSource } from "@/lib/types";

export interface RetrievedChunk {
  /** Citation-ready metadata surfaced to the UI. */
  source: RetrievedSource;
  /** Full chunk text passed to the model (not sent to the client). */
  text: string;
}

/**
 * Retrieve the most relevant chunks for a query from the agent's namespace.
 * Only chunks at or above the similarity threshold are returned, so the
 * presence of sources is equivalent to "the answer is grounded".
 */
export async function retrieveChunks(
  agent: AgentKey,
  query: string,
): Promise<RetrievedChunk[]> {
  const namespace = AGENTS[agent].namespace;
  if (!namespace) return [];

  const hits = await queryNamespace(namespace, query, RETRIEVAL.topK);
  const strong = hits
    .filter((h) => h.score >= RETRIEVAL.minScore)
    .slice(0, RETRIEVAL.maxContextChunks);

  return strong.map((h, i) => {
    const m = h.metadata;
    const text = h.data ?? m?.snippet ?? "";
    const source: RetrievedSource = {
      id: h.id,
      docId: m?.docId ?? "",
      title: m?.title ?? m?.source ?? "Source",
      source: m?.source ?? "unknown",
      category: (m?.category as DocCategory) ?? (namespace as DocCategory),
      score: Number(h.score.toFixed(3)),
      snippet: text.replace(/\s+/g, " ").trim().slice(0, 220),
      index: i + 1,
    };
    return { source, text };
  });
}

/** Build the [n]-numbered CONTEXT block handed to the answering model. */
export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c) =>
        `[${c.source.index}] (${c.source.title} — ${c.source.source})\n${c.text}`,
    )
    .join("\n\n---\n\n");
}
