# Architecture Note — Simplilearn AI Assistant

*A multi-agent, retrieval-augmented chatbot for learner queries.*

This note covers the four items requested in the assignment: **agent architecture**,
**agent responsibilities**, the **RAG flow**, and **key limitations**.

---

## 1. Agent architecture

The system uses an **orchestrator → specialist** pattern. Rather than one monolithic
prompt, a lightweight router classifies each query and dispatches it to the specialist
best suited to answer it. Each specialist retrieves only from its own slice of the
knowledge base.

```
                          ┌─────────────────────┐
        Learner query ───▶│   Router Agent       │   (Groq llama-3.1-8b, JSON output)
                          │   classify intent    │   (skipped if the learner picks
                          └───────┬───────┬──────┘    an agent in the UI)
              academic │          │       │          │ other
        ┌──────────────▼───┐  ┌───▼───────────────┐  │
        │  Academic Agent  │  │ Help & Support     │  │  General reply
        │  namespace:      │  │ Agent              │  │  (no retrieval)
        │  "academic"      │  │ namespace:"support"│  │
        └────────┬─────────┘  └─────────┬──────────┘  │
                 │   retrieve top-k     │             │
                 ▼                      ▼             ▼
            Upstash Vector  ◀───────────┘     Groq llama-3.3-70b (streamed answer
            (Sparse / BM25)                     grounded on retrieved context)
```

**Why multi-agent rather than a single prompt?**

- **Separation of corpora.** Academic content and support/policy content live in
  separate vector namespaces, so an assignment question never retrieves a refund
  policy and vice-versa. This improves retrieval precision.
- **Specialized behavior.** The Academic agent *coaches* (hints over hand-outs); the
  Support agent is *direct and procedural*. Different system prompts encode that.
- **Cost & latency.** Classification is a tiny, fast call on a small model
  (`llama-3.1-8b-instant`); only the final answer uses the stronger model
  (`llama-3.3-70b-versatile`). Both run free on Groq.
- **Extensibility.** Adding a third agent (e.g. "Careers") is a new namespace + persona,
  not a rewrite.
- **Learner override.** The UI also lets the learner pick an agent directly (Academic /
  Help & Support); when set, the server skips the router and uses that specialist.

**Implementation:** the orchestration runs server-side in a single streaming endpoint
(`app/api/chat/route.ts`). The router (`lib/agents/router.ts`) calls Groq with JSON
output (`response_format: json_object`) so the result is a strict
`{category, confidence, reasoning}` object; a deterministic keyword fallback guarantees
the chat never hard-fails if the routing call errors.

---

## 2. Agent responsibilities

| Agent | Responsibility | Model | Retrieves from |
| ----- | -------------- | ----- | -------------- |
| **Router / Orchestrator** | Classify the learner's intent into `academic`, `support`, or `other`; return a confidence and a one-line rationale; dispatch to the right specialist. | `llama-3.1-8b-instant` | — |
| **Academic Agent** | Explain concepts simply, build intuition, guide learners through assignments / projects / quizzes. Coaches toward the answer rather than just handing over graded solutions. Cites sources. | `llama-3.3-70b-versatile` | `academic` namespace |
| **Help & Support Agent** | Resolve certificates, schedules, live-class & platform access, payments, refunds, and account logistics. Gives exact steps/policy from context; escalates to humans when the issue needs account-specific data. Cites sources. | `llama-3.3-70b-versatile` | `support` namespace |
| **General (fallback)** | Handle greetings / off-topic messages: respond briefly and steer the learner toward what the assistant can help with. No retrieval. | `llama-3.3-70b-versatile` | — |

Shared guardrails (in `lib/prompts.ts`): answer **from the retrieved context**, cite
sources inline as `[1]`, `[2]`, and **never fabricate** specifics (dates, prices,
policies). If the context lacks the answer, say so and give safe general guidance.

---

## 3. RAG flow

### Ingestion (admin side)

1. **Upload** a PDF / DOCX / TXT / Markdown file (or paste text) in `/admin`, tagged
   **Academic** or **Help & Support** (`app/api/ingest/route.ts`).
2. **Extract** plain text — `unpdf` for PDF, `mammoth` for DOCX, direct read for text
   (`lib/extract.ts`).
3. **Chunk** into ~1,100-character overlapping windows on paragraph boundaries
   (`lib/chunk.ts`) so semantically-coherent passages are embedded together.
4. **Index + store** — each chunk is upserted (as raw text) into the category's
   **namespace** in a Upstash Vector **Sparse / BM25** index. Upstash builds the BM25
   sparse vectors server-side from the text, so no embedding model or key is needed.
   Rich metadata (docId, title, source, category, chunk index, snippet, timestamp)
   rides with each vector (`lib/vector.ts`).

### Retrieval & generation (learner side)

1. **Route** — the router classifies the latest message (§1), unless the learner has
   selected an agent in the UI (then that agent is used directly).
2. **Retrieve** — for `academic`/`support`, run a **BM25 keyword search** of the query
   against that agent's namespace and fetch the **top-k** matching chunks
   (`lib/agents/retrieve.ts`). BM25 returns only term-matching chunks, so any results ⇒
   "grounded".
3. **Assemble context** — selected chunks are numbered `[1..n]` and injected into the
   specialist's system prompt.
4. **Generate** — the answer model (`llama-3.3-70b-versatile`) streams a grounded answer
   with inline citations (`lib/agents/answer.ts`).
5. **Stream to UI** — the endpoint emits NDJSON events: `status` (stage updates),
   `meta` (chosen agent + routing decision + sources), `delta` (token chunks), `done`.
   The UI renders the agent badge, the streamed markdown answer, and a list of cited
   sources.

**Grounding contract:** the presence of sources is equivalent to "the answer is
grounded." When BM25 returns no matching chunk, the model is told no documents were
found and instructed to avoid inventing specifics.

---

## 4. Key limitations

This is a working **prototype**, optimized for clarity and quick deployment. Known
limitations and the path to production:

- **Authentication.** The admin console is gated by a single shared password
  (HMAC-signed session cookie). Production should use real user accounts / SSO and
  role-based access; learners are currently unauthenticated.
- **Document management at scale.** Listing/deleting documents scans the vector index
  via `range()`. This is fine for hundreds of documents but should be backed by a
  metadata table (e.g. Postgres) for large corpora.
- **Retrieval quality.** Retrieval uses **BM25 keyword search** (free, keyless), which
  matches on shared words rather than meaning. Swapping the Upstash index to a Dense
  embedding model would add semantic search; re-ranking, hybrid search, and query
  rewriting are further natural next steps.
- **Routing is single-label.** Each query goes to exactly one agent. Genuinely mixed
  queries ("explain X *and* when's my certificate?") are routed to the dominant intent;
  a production version could fan out to multiple agents and merge.
- **No persistence of conversations.** History lives in the browser session only; it is
  not stored server-side, so there's no analytics, audit trail, or cross-device resume.
- **No evaluation harness.** There are no automated retrieval/answer-quality tests yet;
  adding a small eval set (golden questions → expected sources) would catch regressions.
- **Parsing fidelity.** Complex PDFs (scanned images, multi-column layouts, tables) may
  extract imperfectly. OCR and layout-aware parsing would improve coverage.
- **Cost/latency knobs are static.** `topK`, chunk size, and models are configured
  globally rather than tuned per agent or per traffic pattern.

### What this prototype does demonstrate

A complete, deployable loop: **admin ingestion → indexing → namespaced vector store →
intent routing → grounded, cited, streaming answers**, with a clean separation between
the Academic and Help & Support domains and a UI that makes the multi-agent behavior
visible to the learner (and lets them pick an agent directly). The whole stack runs on
free tiers — Groq for the LLM and Upstash for retrieval.
