import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic";
import { ROUTER_MODEL, type AgentKey } from "@/lib/config";
import { ROUTER_SYSTEM } from "@/lib/prompts";
import type { RouteDecision } from "@/lib/types";

const routeTool: Anthropic.Tool = {
  name: "route",
  description: "Route the learner query to the correct specialist agent.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["academic", "support", "other"],
        description: "Which specialist agent should handle this query.",
      },
      confidence: {
        type: "number",
        description: "Confidence in the classification, from 0 to 1.",
      },
      reasoning: {
        type: "string",
        description: "One short sentence explaining the routing decision.",
      },
    },
    required: ["category", "confidence", "reasoning"],
  },
};

const VALID: AgentKey[] = ["academic", "support", "other"];

/**
 * Router / orchestration agent.
 * Uses a fast model with forced tool-use to classify the query, with a
 * deterministic keyword fallback so the chat never hard-fails on a routing hiccup.
 */
export async function routeQuery(query: string): Promise<RouteDecision> {
  try {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: ROUTER_MODEL,
      max_tokens: 200,
      system: ROUTER_SYSTEM,
      tools: [routeTool],
      tool_choice: { type: "tool", name: "route" },
      messages: [{ role: "user", content: query }],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use") {
      const input = block.input as {
        category?: string;
        confidence?: number;
        reasoning?: string;
      };
      const category = (VALID as string[]).includes(input.category ?? "")
        ? (input.category as AgentKey)
        : "other";
      return {
        category,
        confidence:
          typeof input.confidence === "number"
            ? Math.max(0, Math.min(1, input.confidence))
            : 0.5,
        reasoning: input.reasoning?.trim() || "Classified by the routing agent.",
      };
    }
  } catch {
    // fall through to the keyword heuristic
  }

  return keywordFallback(query);
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
