# AskOps threat model

Scope: the AskOps application (Next.js app, RAG pipeline, Postgres data
tier) as implemented in this repository. This is a portfolio project built
to demonstrate the controls a regulated environment expects from an
internal RAG assistant, so every mitigation below names the actual code
path that enforces it, not an aspirational statement.

## Assets

- **The corpus**, including restricted documents. `data/corpus/` ships 20
  synthetic operational documents; `documents.classification` marks each
  `general` or `restricted` (for example `api-key-rotation-sop`,
  `backup-restore-runbook`, `database-failover-procedure`, and
  `incident-escalation-matrix` are `restricted`).
- **The audit log** (`audit_log` table): who asked what, which chunks were
  retrieved and cited, cost, latency, and trace id per request.
- **Session tokens**: Auth.js JWT sessions, signed with `AUTH_SECRET`.
- **Provider API keys**: `ANTHROPIC_API_KEY`, `EMBEDDINGS_API_KEY`,
  `AZURE_SEARCH_API_KEY`.
- **The system prompt** (`src/rag/prompt.ts`): the behavioral contract
  that keeps answers grounded and refusals honest.

## Actors

- **member**: authenticated employee, scoped to `general` documents.
- **ops_admin**: authenticated operator, scoped to `general` and
  `restricted` documents.
- **Unauthenticated internet**: no session; blocked at the edge.
- **A malicious insider with member role**: valid credentials, uses the
  question itself to try to escalate privilege or exfiltrate restricted
  content.
- **A compromised document author**: a source document, or its upstream
  source before ingest, is edited by an attacker to carry an embedded
  instruction, then gets ingested as ordinary corpus content.

## Threats and mitigations

### Prompt injection, via the question and via poisoned corpus documents

An attacker either types an override attempt directly ("ignore previous
instructions...") or plants one inside a document that later gets
retrieved and shown to the model as context.

- Retrieved content is delimited (`<retrieved_context>`/`<document>` tags
  in `src/rag/llm.ts`), and the system prompt states outright that it is
  data, not instructions (`src/rag/prompt.ts`, rule 4).
- The hardened system prompt also tells the model to refuse, using the
  exact `REFUSAL_TEXT` phrase, if the question asks it to ignore rules,
  change role, or reveal the prompt (rule 5).
- `detectInjection()` (`src/rag/guardrails.ts`) flags known override
  phrasing with a labeled verdict written to `audit_log` on every request,
  whether or not it changed the outcome.
- SQL scoped retrieval bounds the blast radius of a poisoned `general`
  document: even if its embedded instruction demands restricted content, a
  `member` caller's query never retrieves restricted rows in the first
  place (see "Data exfiltration across roles" below), so there is nothing
  restricted for the document to leak.
- Deterministic citation validation (`src/rag/citations.ts`) strips any
  `[n]` marker that does not map to a chunk actually retrieved, so a
  poisoned document cannot make the model fabricate a citation to content
  it was never shown.
- Proven by the `prompt_injection` eval category
  (`evals/judges/deterministic.ts`, `judgeInjectionResistance`), gated at
  100 percent in `evals/gates.ts`.

### Data exfiltration across roles

A `member` attempts, directly or through a crafted question, to see
`restricted` content.

- The classification filter is inside the SQL query itself:
  `PgVectorRetriever` (`src/rag/retriever.pgvector.ts`) issues
  `WHERE d.classification IN (allowed...)` before ranking or limiting
  results; `AzureAISearchRetriever` applies the equivalent `$filter`.
  There is no post-hoc filtering step to forget.
- The policy is one table (`src/rbac/policy.ts`): `member -> ["general"]`,
  `ops_admin -> ["general", "restricted"]`.
- Proven by `tests/unit/rbac-retrieval.test.ts` against a real database,
  and by the eval harness's scope-violation check, any restricted chunk
  retrieved for a `member` role item fails that item outright.
- Every request, successful or not, leaves an `audit_log` row naming the
  exact chunk ids retrieved and cited, so a violation is provable after
  the fact even if it somehow occurred.

### Secrets exposure

- All configuration is read through `src/config/env.ts`, one zod schema;
  no module reads `process.env` directly, and no secret has a hardcoded
  fallback.
- `.github/workflows/ci.yml` runs gitleaks on every push and pull request
  (`.gitleaks.toml` extends the default ruleset and allowlists only
  placeholder values in `.env.example`).
- `.env.example` ships with every key blank; the file is a shape, not a
  value.
- In production, secrets live in Azure Key Vault (`infra/README.md`, RBAC
  authorization mode, no access policies) and are mirrored into Vercel
  project environment variables, since Vercel does not read Key Vault
  directly.

### Session risks

- Auth.js v5 with JWT sessions (`session: { strategy: "jwt" }`), signed
  with `AUTH_SECRET`.
- Microsoft Entra ID (OIDC) is the production identity provider; the app
  role claim (`AskOps.OpsAdmin` / `AskOps.Member`) is mapped to the
  internal role once, at sign in (`src/auth/roles.ts`).
- The local dev Credentials provider is only ever registered when
  `AUTH_DEV_BYPASS=true`, and `src/config/env.ts` throws at process boot,
  refusing to start, if that flag is true while `NODE_ENV` or
  `VERCEL_ENV` is `production`. This is a boot time hard failure, not a
  runtime check an attacker could race or bypass with a header.

### Audit integrity

- `writeAuditEntry()` (`src/observability/audit.ts`) catches and logs its
  own failure instead of throwing, so a database hiccup on the audit
  write never fails the user's request. This fail open trade-off,
  availability over audit completeness, is recorded in ADR 0007.
- The OpenTelemetry trace pipeline (`src/observability/otel.ts`) is the
  second, independent record: `ask.request`, `ask.retrieve`, and
  `ask.generate` spans are force flushed before the response returns, so a
  single audit-write failure does not erase all evidence the request
  happened.

### Rate limiting as DoS mitigation

- Requests are keyed by authenticated user id (`ask:${session.user.id}`),
  never by IP, since every path already requires a session.
- `MemoryRateLimiter` (single instance local dev) or `PostgresRateLimiter`
  (`rate_limit_events` table, for serverless instances that share no
  memory) enforce a 60 second sliding window at `RATE_LIMIT_PER_MINUTE`
  (default 20), checked before body parsing or retrieval so an abusive
  authenticated caller is throttled cheaply.

## Fit for a regulated environment

The combination of SQL enforced retrieval RBAC and a per request audit
row is what makes data access provable rather than merely policy: for any
question asked, the system can show who asked it, under which role, which
chunks were considered and which were actually cited, what it cost, and
under which trace id, without relying on the model's own account of what
it did.
