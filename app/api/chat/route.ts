import { NextRequest } from "next/server";
import { routeQuery } from "@/lib/agents/router";
import { retrieveChunks, buildContextBlock, type RetrievedChunk } from "@/lib/agents/retrieve";
import { createAnswerStream } from "@/lib/agents/answer";
import { buildAnswerSystem } from "@/lib/prompts";
import type { ChatMessage, ChatStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = (body as { messages?: unknown })?.messages;
  const messages: ChatMessage[] = (Array.isArray(raw) ? raw : []).filter(
    (m): m is ChatMessage =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return Response.json({ error: "No user message provided." }, { status: 400 });
  }
  const query = lastUser.content.trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      try {
        // 1) Route → which specialist agent should handle this?
        send({ type: "status", value: "Understanding your question…" });
        const route = await routeQuery(query);

        // 2) Retrieve grounding context from that agent's namespace.
        let chunks: RetrievedChunk[] = [];
        if (route.category !== "other") {
          send({ type: "status", value: "Searching the knowledge base…" });
          try {
            chunks = await retrieveChunks(route.category, query);
          } catch {
            // A vector hiccup should degrade to an ungrounded answer, not a failure.
            chunks = [];
          }
        }

        send({
          type: "meta",
          agent: route.category,
          route,
          sources: chunks.map((c) => c.source),
        });

        // 3) Generate a grounded, streamed answer.
        const system = buildAnswerSystem(
          route.category,
          buildContextBlock(chunks),
          chunks.length > 0,
        );

        const llm = createAnswerStream(system, messages);
        for await (const event of llm) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "delta", value: event.delta.text });
          }
        }

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", value: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("ANTHROPIC_API_KEY")) {
    return "The assistant isn't configured yet — the Anthropic API key is missing. (Admin: set ANTHROPIC_API_KEY.)";
  }
  if (msg.toLowerCase().includes("vector store")) {
    return "The knowledge base isn't configured yet — the vector database connection is missing.";
  }
  if (msg.includes("401") || msg.toLowerCase().includes("authentication")) {
    return "The Anthropic API key was rejected. Please check it's valid.";
  }
  return "Something went wrong while generating a response. Please try again.";
}
