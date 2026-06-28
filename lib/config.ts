/**
 * Central configuration for models, categories, and retrieval tuning.
 * Model IDs are overridable via env so the deployment can be tuned without code changes.
 */

// Fast, low-cost model for query classification / routing.
export const ROUTER_MODEL = process.env.ROUTER_MODEL ?? "claude-haiku-4-5";

// Higher-quality model for generating grounded, learner-facing answers.
export const ANSWER_MODEL = process.env.ANSWER_MODEL ?? "claude-sonnet-4-6";

export const BRAND = {
  name: "Simplilearn",
  product: "Simplilearn AI Assistant",
  tagline: "Your learning companion for coursework, support & everything in between.",
} as const;

export type AgentKey = "academic" | "support" | "other";

export const AGENTS: Record<
  AgentKey,
  {
    key: AgentKey;
    label: string;
    /** Vector DB namespace this agent retrieves from. "other" uses no namespace. */
    namespace: "academic" | "support" | null;
    description: string;
    examples: string[];
  }
> = {
  academic: {
    key: "academic",
    label: "Academic Agent",
    namespace: "academic",
    description:
      "Explains course concepts, walks through assignments, projects, quizzes, and gives learning guidance.",
    examples: [
      "Explain overfitting in simple terms.",
      "I'm stuck on my assignment. Can you guide me?",
      "What should I focus on for the final project?",
    ],
  },
  support: {
    key: "support",
    label: "Help & Support Agent",
    namespace: "support",
    description:
      "Handles certificates, schedules, platform access, payments, refunds, and FAQs.",
    examples: [
      "When will I receive my certificate?",
      "I can't access my live class.",
      "What is the refund policy?",
    ],
  },
  other: {
    key: "other",
    label: "General",
    namespace: null,
    description: "Greetings and queries outside the academic/support scope.",
    examples: [],
  },
};

// Upload categories an admin can choose; each maps to a retrieval namespace.
export const DOC_CATEGORIES = [
  {
    value: "academic" as const,
    label: "Academic",
    hint: "Course notes, lecture material, assignment & project briefs, quizzes.",
  },
  {
    value: "support" as const,
    label: "Help & Support",
    hint: "FAQs, certificate / schedule info, payment & refund policies.",
  },
];

export type DocCategory = (typeof DOC_CATEGORIES)[number]["value"];

// Retrieval tuning.
export const RETRIEVAL = {
  topK: 5,
  // Upstash cosine similarity score (0..1). Chunks below this are treated as weak context.
  minScore: 0.7,
  // Chunking
  chunkSize: 1100, // characters
  chunkOverlap: 150,
  maxContextChunks: 6,
};
