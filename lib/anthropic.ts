import OpenAI from "openai";

/**
 * LLM client.
 *
 * Uses Groq's free, OpenAI-compatible API (no credit card required) so the
 * prototype runs at zero cost. The OpenAI SDK is pointed at Groq's base URL.
 * Swap GROQ_API_KEY + the model IDs in lib/config.ts to use any other
 * OpenAI-compatible provider.
 */

let _client: OpenAI | null = null;

export function getLLM(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com and add it in Vercel env vars.",
    );
  }
  _client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  return _client;
}
