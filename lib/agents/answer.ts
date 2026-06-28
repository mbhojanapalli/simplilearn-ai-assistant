import { getLLM } from "@/lib/anthropic";
import { ANSWER_MODEL } from "@/lib/config";
import type { ChatMessage } from "@/lib/types";

/**
 * Stream a grounded answer from the answering agent.
 *
 * Yields Anthropic-shaped `content_block_delta` events so the chat route's
 * streaming loop stays provider-agnostic.
 */
export async function* createAnswerStream(system: string, history: ChatMessage[]) {
  const client = getLLM();

  // Keep the last few turns to bound token usage.
  const messages = [
    { role: "system" as const, content: system },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
  ];

  const stream = await client.chat.completions.create({
    model: ANSWER_MODEL,
    max_tokens: 1024,
    temperature: 0.3,
    stream: true,
    messages,
  });

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) {
      yield { type: "content_block_delta", delta: { type: "text_delta", text } } as const;
    }
  }
}
