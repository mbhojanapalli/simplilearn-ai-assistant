# Simplilearn AI Assistant

A production-style **multi-agent RAG chatbot** that answers learner queries by
routing each question to the right specialist agent and grounding the answer in an
admin-curated knowledge base.

- 🧭 **Router agent** classifies every query and dispatches it.
- 🎓 **Academic agent** — course concepts, assignments, projects, quizzes, study guidance.
- 🛟 **Help & Support agent** — certificates, schedules, platform access, payments, refunds, FAQs.
- 🎛️ **Manual agent selector** — let it auto-route, or lock answering to a specific agent.
- 📚 **Admin console** — upload PDFs / DOCX / TXT / Markdown; they're chunked, indexed, and stored in a vector DB.
- ⚡ Streaming answers with **agent badges** and **source citations**.

Built with **Next.js 15 (App Router) + TypeScript**, **Groq** (free, OpenAI-compatible
LLM API) for routing and generation, and **Upstash Vector** (serverless, Sparse/BM25
index) for retrieval. Runs at **$0** on free tiers and deploys to **Vercel** in minutes.

> 📄 The architecture write-up (agents, responsibilities, RAG flow, limitations) lives in
> **[ARCHITECTURE.md](./ARCHITECTURE.md)** — that is the assignment "short note" deliverable.

---

## Architecture at a glance

```
                       ┌──────────────────────────────────────────────────┐
   Learner ──"query"──▶│  /api/chat  (Node serverless, streaming)          │
                       │                                                  │
                       │   1. Router agent  (Groq llama-3.1-8b, JSON)     │
                       │        → academic | support | other              │
                       │        (or skipped if the learner picks an agent)│
                       │   2. Retrieve top-k chunks from that agent's     │
                       │        namespace in Upstash Vector (BM25)        │
                       │   3. Answer agent  (Groq llama-3.3-70b, streamed)│
                       │        grounded on retrieved context + cites     │
                       └───────────────┬──────────────────────────────────┘
                                       │  NDJSON stream (meta + deltas)
                                       ▼
                            Chat UI: agent badge · sources · answer

   Admin ──upload──▶ /api/ingest ──▶ extract text → chunk → store in Upstash Vector
                                       (namespace = academic | support)
```

---

## Tech stack

| Layer       | Choice                                       | Why                                                          |
| ----------- | -------------------------------------------- | ------------------------------------------------------------ |
| Framework   | Next.js 15 (App Router) + TypeScript         | One codebase for UI + serverless API; first-class Vercel     |
| LLM         | **Groq** via the `openai` SDK                | Free, OpenAI-compatible, no credit card; fast Llama models   |
| Vector DB   | **Upstash Vector** (Sparse / BM25)           | Serverless, free tier, **keyless** keyword search over text  |
| Parsing     | `unpdf` (PDF), `mammoth` (DOCX)              | Serverless-friendly text extraction                          |
| Styling     | Tailwind CSS + lucide-react                  | Clean, responsive, enterprise UI                             |

**Models** (Groq, free tier, overridable via env):
- Routing / classification → `llama-3.1-8b-instant` (fast, JSON output)
- Answer generation → `llama-3.3-70b-versatile` (higher quality, streamed)

---

## Prerequisites

Two free accounts (no credit card, ~5 minutes total):

1. **Groq** — free LLM API key → <https://console.groq.com>
2. **Upstash** — serverless vector database → <https://console.upstash.com/vector>

---

## 1) Local setup

```bash
# install dependencies
npm install

# create your local env file and fill it in
cp .env.example .env.local
```

### Configure the vector database

In the **Upstash Vector** console, click **Create Index** and:

- Choose a region near you.
- **Type:** select **Sparse**.
- **Model:** select **BM25** (keyword search built in — no embedding model and no extra key).
- Open the index → copy the **REST URL** and **REST Token** into `.env.local`.

### Fill in `.env.local`

```ini
GROQ_API_KEY=gsk_...
UPSTASH_VECTOR_REST_URL=https://your-index.upstash.io
UPSTASH_VECTOR_REST_TOKEN=...
ADMIN_PASSWORD=choose-a-strong-password
```

### Seed the sample knowledge base (optional but recommended)

```bash
npm run seed
```

This loads the documents in [`sample-documents/`](./sample-documents) into the
`academic` and `support` namespaces. You can also upload them later from the admin UI.

### Run it

```bash
npm run dev
# open http://localhost:3000        (learner chat)
# open http://localhost:3000/admin  (admin console — uses ADMIN_PASSWORD)
```

Try: *"Explain overfitting in simple terms."*, *"When will I receive my certificate?"*,
*"What is the refund policy?"*

---

## 2) Deploy to GitHub + Vercel

### Get the code onto GitHub
Either push with git, or use **GitHub → Add file → Upload files** and drag the project
files (so `package.json` lands at the **repo root** — not inside a subfolder).
`.env.local` is git-ignored, so secrets are never committed.

### Import into Vercel
1. Go to <https://vercel.com/new> and **import** the GitHub repo.
2. Make sure **Framework Preset = Next.js** (Settings → Build and Deployment). *(If it
   imports as "Other", the app won't build — set it to Next.js and redeploy.)*
3. Under **Settings → Environment Variables**, add the four keys:
   `GROQ_API_KEY`, `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`, `ADMIN_PASSWORD`.
4. **Deploy** (after adding/changing env vars, redeploy so they take effect).

After it deploys, open the Vercel URL, go to `/admin`, and upload the files in
`sample-documents/` to populate the knowledge base.

---

## Usage

### Learner (chat) — `/`
Ask any question. By default the assistant **auto-routes** to the right agent and shows
which one answered plus its sources. Use the selector above the input (or the agent
cards on the home screen) to **lock** answering to **Academic** or **Help & Support**.
Clicking the **Simplilearn AI Assistant** logo starts a fresh chat.

### Admin (knowledge base) — `/admin`
Sign in with `ADMIN_PASSWORD`. Upload a file or paste text, choose **Academic** or
**Help & Support**, and the document is chunked, indexed, and stored. The console shows
per-category chunk counts and lets you delete documents.

---

## Sample documents (for testing)

The repo ships **six** example documents in [`sample-documents/`](./sample-documents) that
populate the knowledge base. Each is written to answer a specific test query, so you can
verify routing, retrieval, and citations end-to-end. They're already indexed in the live
demo, so the queries below work immediately.

**Academic** — retrieved by the Academic agent:

| File | Contents | Example query it answers |
| --- | --- | --- |
| `overfitting-explained.md` | What overfitting is, how to spot and reduce it | *"Explain overfitting in simple terms."* |
| `machine-learning-course-notes.md` | ML foundations — learning types, the model workflow, evaluation metrics, generalization | General concept / study questions |
| `capstone-project-guidelines.md` | Project deliverables, milestones, grading rubric, and an "if you get stuck" guide | *"I'm stuck on my assignment. Can you guide me?"* |

**Help & Support** — retrieved by the Help & Support agent:

| File | Contents | Example query it answers |
| --- | --- | --- |
| `certificates-faq.md` | Certificate issuance timing, download/share, name corrections | *"When will I receive my certificate?"* |
| `refund-policy.md` | Refund eligibility windows, non-refundable items, how to request | *"What is the refund policy?"* |
| `platform-access-and-live-classes.md` | Live-class access, recordings, login/password, missing courses | *"I can't access my live class."* |

Each document is chunked and indexed into its agent's namespace, so a query only ever
retrieves from the relevant corpus — and the answer cites the specific source it used.

---

## Project structure

```
app/
  page.tsx                 Learner chat page
  admin/page.tsx           Admin console (protected)
  admin/login/page.tsx     Admin login
  api/
    chat/route.ts          Route (or honor selected agent) → retrieve → stream (NDJSON)
    ingest/route.ts        Upload → extract → chunk → store
    documents/route.ts     List / delete documents
    admin/(login|logout|status)/route.ts
    health/route.ts        Reports which integrations are configured
lib/
  anthropic.ts             LLM client — OpenAI SDK pointed at Groq (getLLM)
  agents/router.ts         Query classification (Groq JSON + keyword fallback)
  agents/retrieve.ts       Namespaced vector retrieval + context builder
  agents/answer.ts         Streaming grounded generation
  vector.ts                Upstash Vector client (upsert/query/list/delete/stats)
  chunk.ts  extract.ts     Chunking + PDF/DOCX/TXT text extraction
  prompts.ts  config.ts    Agent personas + central config
  auth.ts                  Admin session (HMAC cookie)
components/                Chat UI (selector, badges, sources), admin console, shared UI
sample-documents/          Seed corpus (academic + support)
scripts/seed.ts            One-command knowledge-base seeding
```

---

## Notes & limitations

A full discussion is in **[ARCHITECTURE.md](./ARCHITECTURE.md)**. In short: this is a
prototype — auth is a single shared admin password, document listing scans the index
(fine for hundreds of docs), and retrieval uses **BM25 keyword search** (great when the
question shares words with the docs; swap the Upstash index to a Dense embedding model
for semantic search).

## Model configuration

Defaults (override via env): routing uses `llama-3.1-8b-instant` and answers use
`llama-3.3-70b-versatile` (both free on Groq). Set `ROUTER_MODEL` / `ANSWER_MODEL` to
change them. To use a different OpenAI-compatible provider, point `lib/anthropic.ts` at
its base URL and set the matching key.
```
