import { RETRIEVAL } from "@/lib/config";

/**
 * Split a document into overlapping chunks suitable for embedding + retrieval.
 *
 * Strategy: greedily pack paragraphs (split on blank lines) into windows of
 * ~chunkSize characters, carrying a small overlap so context isn't lost at
 * chunk boundaries. Falls back to hard slicing for any single oversized block.
 */
export function chunkText(
  text: string,
  opts: { chunkSize?: number; chunkOverlap?: number } = {},
): string[] {
  const chunkSize = opts.chunkSize ?? RETRIEVAL.chunkSize;
  const overlap = opts.chunkOverlap ?? RETRIEVAL.chunkOverlap;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    // start next chunk with a tail overlap of the previous one
    current = overlap > 0 && trimmed.length > overlap ? trimmed.slice(-overlap) + "\n\n" : "";
  };

  for (const block of blocks) {
    if (block.length > chunkSize) {
      // Oversized single block: flush current, then hard-slice the block.
      if (current.trim()) flush();
      for (let i = 0; i < block.length; i += chunkSize - overlap) {
        chunks.push(block.slice(i, i + chunkSize).trim());
      }
      current = "";
      continue;
    }

    if ((current + "\n\n" + block).length > chunkSize) {
      flush();
    }
    current += (current ? "\n\n" : "") + block;
  }

  if (current.trim()) chunks.push(current.trim());

  // De-duplicate accidental empties and return.
  return chunks.filter((c) => c.length > 0);
}
