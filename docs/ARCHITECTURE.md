# AskOps architecture

AskOps is a Next.js 15 App Router application deployed to Vercel. It
answers employee questions from an internal document corpus stored in
Postgres, with retrieval scoped to the caller's role and every answer
grounded in cited source chunks. This document covers the components, the
request data flow, the retrieval pipeline stages exactly as implemented
in `src/rag/pipeline.ts`, and the trust boundaries the system enforces.

## Components

- **Browser**: signs in, submits a question, renders the answer, its
  sources, and a trace id (`app/ask-panel.tsx`).
- **Vercel edge middleware** (`middleware.ts`): gates every path except
  `/signin`, `/api/auth`, and `/api/health` behind an Auth.js session.
- **Auth** (`src/auth/index.ts`): Auth.js (NextAuth v5), JWT sessions.
  Microsoft Entra ID (OIDC) is the production provider; a Credentials
  provider for two fixed dev users exists only when `AUTH_DEV_BYPASS=true`
  outside a production-like environment.
- **Ask route** (`app/api/ask/route.ts`): re-checks the session, rate
  limits, validates the body, runs the pipeline, writes one audit row.
- **Health route** (`app/api/health/route.ts`): unauthenticated liveness
  check against Postgres.
- **RAG pipeline** (`src/rag/pipeline.ts`): `runAskPipeline`, below.
- **Retriever**: `src/rag/retriever.pgvector.ts` (default) or
  `src/rag/retriever.aisearch.ts` (documented alternative), resolving
  question embeddings to ranked, role-scoped document chunks.
- **Postgres + pgvector**: `documents`, `chunks`, `audit_log`, and
  `rate_limit_events` tables (`src/db/schema.ts`).
- **Observability** (`src/observability/otel.ts`): spans per request,
  exported to the console locally or Azure Monitor in production.
- **Audit** (`src/observability/audit.ts`): one row per ask, in
  `audit_log`, Postgres.

## Data flow

```
Browser
  |  HTTPS
  v
middleware.ts (session gate, PUBLIC_PATHS bypass)
  v
app/api/ask/route.ts
  |- auth() session re-check
  |- getRateLimiter().check(`ask:${userId}`)   -> 429 if exceeded
  |- askRequestSchema.safeParse(body)           -> 400 if invalid
  |- runAskPipeline({ question, role })
  v
src/rag/pipeline.ts (runAskPipeline)
  |- detectInjection(question)        [guardrails.ts, flags only]
  |- allowedClassifications(role)     [rbac/policy.ts]
  |- retriever.retrieve(question, {...})
  |     v
  |   PgVectorRetriever: embed question, then SQL WHERE classification
  |   IN (allowed) ORDER BY embedding <=> query LIMIT topK, against
  |   Postgres + pgvector. (AzureAISearchRetriever is the same contract
  |   against an Azure AI Search index, see "Alternative retriever" below.)
  |- retrieved.length === 0 ? refuse (REFUSAL_TEXT), skip generation
  |- buildSystemPrompt() + delimited <retrieved_context>/<user_question>
  |- llm.generate(...)      -> AnthropicProvider or MockProvider
  |- processCitations(text, retrieved)      [citations.ts]
  v
AskResult
  |
  +--> withSpan() spans, force-flushed  --> console (dev) or Azure
  |    before the response returns          Monitor (prod) [otel.ts]
  +--> writeAuditEntry(), redacts PII   --> audit_log (Postgres); a
       from the question first              failed write is logged,
       [observability/audit.ts]              not thrown
```

## Retrieval pipeline stages

`runAskPipeline` in `src/rag/pipeline.ts` executes these stages in order,
every time:

1. **Injection heuristics.** `detectInjection(question)` runs regex checks
   for known override phrasing. It never blocks the request; the verdict
   travels with the result so it lands in the audit row regardless of
   outcome.
2. **Role to allowed classifications.** `allowedClassifications(role)`
   resolves the caller's role (`member` or `ops_admin`) to the document
   classifications it may see, from the single policy table in
   `src/rbac/policy.ts`.
3. **SQL filtered vector search.** The retriever embeds the question, then
   queries with the classification filter inside the `WHERE` clause
   (`WHERE d.classification IN (allowed...)`), ordered by cosine distance
   and limited to `RETRIEVAL_TOP_K` (default 6). Rows below
   `RETRIEVAL_MIN_SIMILARITY` (default 0.21, tuned against the golden
   dataset, see `docs/RUNBOOK.md`) are dropped before the pipeline sees
   them.
4. **Threshold refusal.** If nothing survives the filter, the pipeline
   returns the exact refusal string without calling the model, so no
   generation call happens for an unanswerable question.
5. **Delimited prompt assembly.** `buildSystemPrompt()`
   (`src/rag/prompt.ts`) supplies a fixed system prompt. `src/rag/llm.ts`
   wraps every retrieved chunk in `<document ref="n" title="...">` inside
   a `<retrieved_context>` block, and the question inside
   `<user_question>`. No user text is ever interpolated into the system
   prompt string.
6. **Generation.** `llm.generate()` calls `AnthropicProvider` (the
   default) or `MockProvider` (`LLM_PROVIDER=mock`), which answers
   deterministically from the same context using term overlap scoring so
   tests, CI, and the eval harness run with no network call and no key.
7. **Deterministic citation validation.** `processCitations()`
   (`src/rag/citations.ts`) parses `[n]` markers from the model's answer.
   Any marker that does not correspond to a chunk actually retrieved is
   stripped from the text and reported in `invalidCitationRefs`, so a
   fabricated citation cannot reach the user silently.

## Trust boundaries

- **User input is untrusted.** The question is validated by
  `askRequestSchema` (`src/rag/guardrails.ts`: trimmed, 3 to 2000
  characters), scanned for injection phrasing, and placed only inside the
  `<user_question>` tag of the user message, never the system prompt.
- **Retrieved corpus content is treated as untrusted data in the prompt.**
  System prompt rule 4 (`src/rag/prompt.ts`) states outright that the
  content inside `<retrieved_context>` is data, not instructions, and that
  any embedded commands inside it must be ignored. A poisoned document can
  say whatever it wants; the model is told not to obey it.
- **Role comes only from the server side session.** `app/api/ask/route.ts`
  reads `session.user.role` from the Auth.js JWT (set once at sign in, in
  the `jwt` callback in `src/auth/index.ts`, from the Entra ID `roles`
  claim or the fixed dev user). The request body carries only the
  question; no client-suppliable role field exists anywhere in the
  pipeline.
- **The model never receives chunks outside the caller's classifications,
  because the filtering happens in SQL.** `PgVectorRetriever` applies
  `WHERE d.classification IN (allowed...)` before ranking or limiting
  results, so restricted rows are excluded at the database layer. No
  later step could leak a restricted chunk the query never returned.

## Embeddings and hermetic CI

`src/rag/embeddings.ts` defines the `EmbeddingsProvider` interface behind
`EMBEDDING_DIMENSIONS = 1536`. Every implementation must emit 1536
dimensional vectors because `chunks.embedding` is declared
`vector("embedding", { dimensions: 1536 })` in `src/db/schema.ts`, a
single fixed width pgvector column that both providers write into and
both retrievers query against. `text-embedding-3-small` (the default
`EMBEDDINGS_MODEL` for `EMBEDDINGS_PROVIDER=openai`) natively emits 1536
dimensions; `LocalHashEmbeddings` (`EMBEDDINGS_PROVIDER=local`, the
default) is a deterministic, dependency free hash embedding tuned to the
same width, so it is a drop in replacement that needs no key. Together
with `MockProvider` (`LLM_PROVIDER=mock`) it needs no external key or
network call, which is why `ci.yml` and the default mode of `eval.yml`
run entirely against them.

## Entra ID setup (operator steps)

The app expects an Entra ID app registration with two app roles. One time
setup in the operator's tenant:

1. Register an application (Microsoft Entra admin center, App
   registrations, New registration). Redirect URI (web):
   `https://<your-vercel-domain>/api/auth/callback/microsoft-entra-id`
   (plus `http://localhost:3000/...` for local testing against the
   tenant).
2. Create a client secret and record it.
3. Under App roles, create two roles with these exact values (they are
   what `src/auth/roles.ts` matches on): `AskOps.Member` (display name
   "AskOps Member", allowed member types Users/Groups) and
   `AskOps.OpsAdmin`.
4. In Enterprise applications, assign users or groups to those roles.
   Anyone signed in without an explicit role assignment is treated as
   `member` (least privilege default in `roleFromEntraProfile`).
5. Set `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`,
   `AZURE_AD_TENANT_ID`, and `AUTH_SECRET` in the deployment environment
   (Key Vault mirrored to Vercel project settings, see
   `infra/README.md`).

Entra places granted role values in the `roles` claim of the id token;
the `jwt` callback pins the mapped application role onto the session at
sign in.

## Alternative retriever: Azure AI Search

`RETRIEVER=aisearch` swaps `PgVectorRetriever` for `AzureAISearchRetriever`
(`src/rag/retriever.aisearch.ts`) against an index whose fields mirror the
pgvector schema. Its classification filter is applied through the search
`$filter` expression, mirroring the SQL `WHERE` clause, so the same trust
boundary holds regardless of which retriever is active. Both satisfy the
same `Retriever` contract (`src/rag/retriever.ts`), so switching is a
configuration change, not a rewrite.
