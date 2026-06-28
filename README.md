# Simplilearn AI Assistant

A production-style **multi-agent RAG chatbot** that answers learner queries by
routing each question to the right specialist agent and grounding the answer in an
admin-curated knowledge base.

- 🧭 **Router agent** classifies every query and dispatches it.
- 🎓 **Academic agent** — course concepts, assignments, projects, quizzes, study guidance.
- 🛟 **Help & Support agent** — certificates, schedules, platform access, payments, refunds, FAQs.
- 📚 **Admin console** — upload PDFs / DOCX / TXT / Markdown; they're chunked, embedded, and stored in a vector DB.
- ⚡ Streaming answers with **agent badges** and **source citations**.

Built with **Next.js 15 (App Router) + TypeScript**, **Claude** (Anthropic) for routing
and generation, and **Upstash Vector** (serverless, with built-in embeddings) for retrieval.
Designed to deploy to **Vercel** in minutes.

> 📄 The architecture write-up (agents, responsibilities, RAG flow, limitations) lives in
> **[ARCHITECTURE.md](./ARCHITECTURE.md)** — that is the assignment "short note" deliverable.

---

## Architecture at a glance

```
                       ┌──────────────────────────────────────────────┐
   Learner ──"query"──▶│  /api/chat  (Node serverless, streaming)      │
                       │                                              │
                       │   1. Router agent  (Claude Haiku, tool-use)  │
                       │        → academic | support | other          │
                       │   2. Retrieve top-k chunks from that agent's │
                       │        namespace in Upstash Vector           │
                       │   3. Answer agent  (Claude Sonnet, streamed)  │
                       │        grounded on retrieved context + cites  │
                       └───────────────┬──────────────────────────────┘
                                       │  NDJSON stream (meta + deltas)
                                       ▼
                            Chat UI: agent badge · sources · answer

   Admin ──upload──▶ /api/ingest ──▶ extract text → chunk → embed → Upstash Vector
                                       (namespace = academic | support)
```

---

## Tech stack

| Layer            | Choice                                   | Why                                                      |
| ---------------- | ---------------------------------------- | -------------------------------------------------------- |
| Framework        | Next.js 15 (App Router) + TypeScript     | One codebase for UI + serverless API; first-class Vercel |
| LLM              | Anthropic **Claude** (`@anthropic-ai/sdk`) | Routing (Haiku) + grounded generation (Sonnet)          |
| Vector DB        | **Upstash Vector**                       | Serverless, free tier, **built-in embeddings** (no extra key) |
| Embeddings       | Upstash built-in (e.g. `bge-base-en-v1.5`) | No separate embeddings provider to manage               |
| Parsing          | `unpdf` (PDF), `mammoth` (DOCX)          | Serverless-friendly text extraction                      |
| Styling          | Tailwind CSS + lucide-react              | Clean, responsive, enterprise UI                         |

---

## Prerequisites

You'll create two free accounts (5 minutes total):

1. **Anthropic** — for the Claude API key → <https://console.anthropic.com>
2. **Upstash** — for the serverless vector database → <https://console.upstash.com/vector>

---

## 1) Local setup

```bash
# install dependencies
npm install

# create your local env file and fill it in
cp .env.example .env.local
```

### Configure the vector database (important)

In the **Upstash Vector** console, click **Create Index** and:

- Choose a region near you.
- Under **Embedding Model**, select a model — recommended: **`BAAI/bge-base-en-v1.5`**.
  This lets the app upsert/query with raw text and have Upstash embed it server-side,
  so you don't need a separate embeddings API key.
- Open the index → **Details** → copy the **REST URL** and **REST Token** into `.env.local`.

### Fill in `.env.local`

```ini
ANTHROPIC_API_KEY=sk-ant-...
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

### Push to GitHub

```bash
git init
git add -A
git commit -m "Simplilearn AI Assistant — multi-agent RAG chatbot"
git branch -M main
# create an empty repo on github.com first, then:
git remote add origin https://github.com/<you>/simplilearn-ai-assistant.git
git push -u origin main
```

> `.env.local` is git-ignored — your secrets are never committed.

### Import into Vercel

1. Go to <https://vercel.com/new> and **import** the GitHub repo.
2. Vercel auto-detects Next.js — no build settings to change.
3. Under **Environment Variables**, add the same four keys from `.env.local`:
   `ANTHROPIC_API_KEY`, `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`, `ADMIN_PASSWORD`.
4. Click **Deploy**.

After it deploys, open the Vercel URL. To load the sample data on the deployed app,
either run `npm run seed` locally (it writes to the same Upstash index) **or** upload
documents from `/admin`.

> **Tip:** add the Upstash **Vercel Integration** to auto-inject the Upstash env vars,
> or just paste them manually as above.

---

## Usage

### Learner (chat) — `/`
Ask any question. The assistant shows which agent handled it and lists the sources
it used. If the knowledge base has no relevant content, it says so instead of
making things up.

### Admin (knowledge base) — `/admin`
Sign in with `ADMIN_PASSWORD`. Upload a file or paste text, choose **Academic** or
**Help & Support**, and the document is chunked, embedded, and indexed. The console
shows per-category chunk counts and lets you delete documents.

---

## Project structure

```
app/
  page.tsx                 Learner chat page
  admin/page.tsx           Admin console (protected)
  admin/login/page.tsx     Admin login
  api/
    chat/route.ts          Router → retrieve → stream answer (NDJSON)
    ingest/route.ts        Upload → extract → chunk → embed → store
    documents/route.ts     List / delete documents
    admin/(login|logout|status)/route.ts
    health/route.ts        Reports which integrations are configured
lib/
  agents/router.ts         Query classification (Claude tool-use + fallback)
  agents/retrieve.ts       Namespaced vector retrieval + context builder
  agents/answer.ts         Streaming grounded generation
  vector.ts                Upstash Vector client (upsert/query/list/delete/stats)
  chunk.ts  extract.ts     Chunking + PDF/DOCX/TXT text extraction
  prompts.ts  config.ts    Agent personas + central config
  auth.ts                  Admin session (HMAC cookie)
components/                Chat UI, admin console, shared UI
sample-documents/          Seed corpus (academic + support)
scripts/seed.ts            One-command knowledge-base seeding
```

---

## Notes & limitations

A full discussion is in **[ARCHITECTURE.md](./ARCHITECTURE.md)**. In short: this is a
prototype — auth is a single shared admin password, document listing scans the index
(fine for hundreds of docs), and retrieval quality depends on the embedding model and
the documents you upload.

## Model configuration

Defaults (override via env): routing uses `claude-haiku-4-5` (fast, cheap) and answers
use `claude-sonnet-4-6` (strong quality/cost balance). Set `ROUTER_MODEL` / `ANSWER_MODEL`
to change them.
