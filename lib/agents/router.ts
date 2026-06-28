import { getLLM } from "@/lib/anthropic";
import { ROUTER_MODEL, type AgentKey } from "@/lib/config";
import { ROUTER_SYSTEM } from "@/lib/prompts";
import type { RouteDecision } from "@/lib/types";

const VALID: AgentKey[] = ["academic", "support", "other"];

const ROUTER_JSON_INSTRUCTIONS = `

Respond with ONLY a JSON object, no prose, in exactly this shape:
{"category": "academic" | "support" | "other", "confidence": <number 0..1>, "reasoning": "<one short sentence>"}`;

/**
 * Router / orchestration agent.
 * Uses a fast model with JSON output to classify the query, with a deterministic
 * keyword fallback so the chat never hard-fails on a routing hiccup.
 */
export async function routeQuery(query: string): Promise<RouteDecision> {
  try {
    const client = getLLM();
    const res = await client.chat.completions.create({
      model: ROUTER_MODEL,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ROUTER_SYSTEM + ROUTER_JSON_INSTRUCTIONS },
        { role: "user", content: query },
      ],
    });

    const content = res.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      category?: string;
      confidence?: number;
      reasoning?: string;
    };

    const category = (VALID as string[]).includes(parsed.category ?? "")
      ? (parsed.category as AgentKey)
      : "other";
    return {
      category,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.6,
      reasoning: parsed.reasoning?.trim() || "Classified by the routing agent.",
    };
  } catch {
    return keywordFallback(query);
  }
}

/** Deterministic backstop if the LLM router is unavailable. */
function keywordFallback(query: string): RouteDecision {
  const q = query.toLowerCase();
  const supportHints = [
    "certificate",
    "refund",
    "payment",
    "invoice",
    "billing",
    "schedule",
    "login",
    "log in",
    "access",
    "live class",
    "password",
    "enroll",
    "cancel",
    "subscription",
  ];
  const academicHints = [
    "explain",
    "concept",
    "assignment",
    "project",
    "quiz",
    "overfitting",
    "algorithm",
    "how do i",
    "what is",
    "stuck",
    "solve",
    "study",
    "learn",
  ];

  const supportScore = supportHints.filter((h) => q.includes(h)).length;
  const academicScore = academicHints.filter((h) => q.includes(h)).length;

  if (supportScore === 0 && academicScore === 0) {
    return { category: "other", confidence: 0.4, reasoning: "Fallback: no domain signals detected." };
  }
  if (supportScore >= academicScore) {
    return { category: "support", confidence: 0.55, reasoning: "Fallback: support keywords detected." };
  }
  return { category: "academic", confidence: 0.55, reasoning: "Fallback: academic keywords detected." };
}
