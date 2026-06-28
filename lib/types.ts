import type { AgentKey, DocCategory } from "@/lib/config";

/** A single retrieved source chunk surfaced to the model and the UI. */
export interface RetrievedSource {
  id: string;
  docId: string;
  title: string;
  source: string; // filename
  category: DocCategory;
  score: number;
  snippet: string;
  index: number; // citation number [n] shown to the user
}

/** Router decision returned by the classification agent. */
export interface RouteDecision {
  category: AgentKey;
  confidence: number;
  reasoning: string;
}

/** Chat message exchanged with the API and rendered in the UI. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Metadata stored alongside every vector chunk in Upstash. */
export interface ChunkMetadata {
  docId: string;
  title: string;
  source: string;
  category: DocCategory;
  chunkIndex: number;
  totalChunks: number;
  uploadedAt: string;
  snippet: string;
  [key: string]: string | number; // Upstash metadata constraint
}

/** A logical document, aggregated from its chunks for the admin console. */
export interface DocumentSummary {
  docId: string;
  title: string;
  source: string;
  category: DocCategory;
  chunks: number;
  uploadedAt: string;
}

/** NDJSON stream events sent from /api/chat to the client. */
export type ChatStreamEvent =
  | { type: "status"; value: string }
  | { type: "meta"; agent: AgentKey; route: RouteDecision; sources: RetrievedSource[] }
  | { type: "delta"; value: string }
  | { type: "done" }
  | { type: "error"; value: string };
