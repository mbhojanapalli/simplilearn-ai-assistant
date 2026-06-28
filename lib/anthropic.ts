import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/** Singleton Anthropic (Claude) client. */
export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in .env.local (local) or Vercel env vars (prod).",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}
