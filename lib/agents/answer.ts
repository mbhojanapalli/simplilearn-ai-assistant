import { getAnthropic } from "@/lib/anthropic";
import { ANSWER_MODEL } from "@/lib/config";
import type { ChatMessage } from "@/lib/types";

/**
 * Create a streaming completion for the answering agent.
 * Returns the Anthropic MessageStream; the caller iterates text deltas.
 */
export function createAnswerStream(system: string, history: ChatMessage[]) {
  const client = getAnthropic();

  // Keep the last few turns to bound token usage; the API tolerates the shape.
  const messages = history
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  return client.messages.stream({
    model: ANSWER_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });
}
