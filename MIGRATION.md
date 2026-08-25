# From v0.1-prototype to v1.0-production

This file is the narrative behind the git history. Each section names a gap
that existed at `v0.1-prototype`, why it mattered, and exactly how
`v1.0-production` closed it. Commits are readable in order; nothing was
squashed.

## 1. Anyone could read anything

**The gap.** The prototype had no sign in and no concept of access. Every
chunk in the database, including documents marked restricted, was
retrievable by whoever could reach the URL. The `classification` column
existed and did nothing.

**The fix.** Auth.js with the Microsoft Entra ID provider; roles come from
Entra app role claims and default to least privilege. Middleware requires a
session on everything except sign in, the auth endpoints, and the health
check. The role travels only in the server side session token, never in the
request. Crucially, enforcement lives inside the retriever's SQL query
(`WHERE d.classification IN (...)`), so restricted chunks are filtered
before the model or the client can ever see them. A unit test inserts
marker documents and proves member retrieval cannot return restricted
content; two eval items ask the identical question as `member` and
`ops_admin` and require opposite outcomes.

**Local development honesty.** A dev sign in path (`dev-member`,
`dev-admin`) exists behind `AUTH_DEV_BYPASS=true`, and the app refuses to
boot when that flag is set in production. The refusal was verified by
watching it happen under `next start`.

## 2. The model guessed when it should have refused

**The gap.** Naive retrieval took the top 5 chunks no matter how weak the
match, so out of scope questions produced confident nonsense assembled from
irrelevant text.

**The fix.** A relevance threshold, tuned against measured similarity
distributions rather than intuition (`scripts/retrieval-debug.ts` prints
scored retrievals for every golden dataset item). Grounded questions score
0.23 and above; out of scope and unauthorized noise tops out at 0.185; the
threshold sits at 0.21. Below it, the pipeline refuses with a fixed phrase
before spending a model call. Refusal correctness gates at 100 percent in
the eval suite.

## 3. Prompt injection was not even considered

**The gap.** The prototype concatenated user text and retrieved text into
one string. Any document or question could rewrite the instructions.

**The fix.** Three layers. The system prompt is static and never
interpolates user input; retrieved content travels in the user message
inside labeled tags and is explicitly declared untrusted data. Heuristics
flag classic injection phrasings and record the labels in the audit log, so
attempts are visible without blocking legitimate questions. And because
RBAC runs inside the SQL query, a successful jailbreak of the model still
cannot surface restricted chunks: they were never in context. Six eval
items attack the pipeline (instruction override, system prompt extraction,
fake delimiters, role override, claimed privilege, DAN phrasing); injection
resistance gates at 100 percent, including a scope violation check and a
system prompt leak check on every one.

## 4. Nothing was observable and nothing was auditable

**The gap.** One `console.log` in the ingest script. No way to answer "who
asked what", "what did it cost", or "why was this answer wrong yesterday".

**The fix.** OpenTelemetry tracing with `ask.request`, `ask.retrieve`, and
`ask.generate` spans carrying token counts, estimated cost, latency,
retrieved chunk ids, and the caller's role. Console exporter locally, Azure
Monitor exporter behind an env var, spans force flushed per request because
serverless instances freeze after responding. Alongside the traces, every
ask writes one audit row: user, role, PII redacted question, refusal flag,
injection flags, chunk ids retrieved and cited, token counts, cost in micro
USD, latency, and the trace id that links the row to the spans. The UI
shows that trace id under every answer so a support report can be joined to
telemetry in one query.

## 5. Secrets were read loosely

**The gap.** `process.env` accessed wherever convenient, with hardcoded
connection string fallbacks and no statement of what configuration existed.

**The fix.** A single zod validated env module that every other module
imports. Misconfiguration fails at boot with a named error, not deep inside
a request. `.env.example` documents the full surface. gitleaks runs in CI
and was run over the entire git history (clean). The IaC provisions Key
Vault as the production secret store, mirrored into Vercel settings.

## 6. There were no tests and no quality bar

**The gap.** Zero tests, no CI, no way to know whether a change broke
retrieval scoping or refusal behavior.

**The fix.** 56 unit tests including database backed RBAC proofs, guardrail
and redaction coverage, tracing assertions against an in memory exporter,
and rate limiter behavior for both stores. A Playwright smoke suite runs
against the production server build. And the headline: a 24 item golden
dataset with deterministic judges scoring groundedness, refusal
correctness, injection resistance, and citation validity, wired as a CI
gate that exits non zero. The gate was deliberately broken during
development (threshold set to zero) to confirm it fails, then restored.

## 7. Ingestion was destructive and unrepeatable

**The gap.** The prototype truncated both tables and reloaded everything on
every run, with paragraph chunks that ignored document structure.

**The fix.** Content hashed idempotent ingestion: unchanged documents are
skipped, changed ones are replaced atomically, deleted files are removed,
and a second consecutive run performs zero writes. Chunking follows
headings and prefixes each chunk with its document title and section, which
measurably improved retrieval precision. The embedding provider name is
hashed in, so switching providers re embeds automatically.

## 8. Deployment was a laptop

**The gap.** No pipeline, no infrastructure definition, no deploy story.

**The fix.** Five GitHub Actions workflows: CI (secret scan, format, lint,
typecheck, unit tests against a pgvector service container, build), the
eval gate (hermetic by default, live model mode by dispatch), preview and
production deploys that skip cleanly when Vercel credentials are absent,
and CodeQL. Dependabot watches npm and the actions themselves. The Azure
data, secrets, and telemetry tier is described twice, in Bicep and in
Terraform, with matching parameter surfaces and outputs, and both stacks
validate cleanly (`az bicep build`, `terraform validate`,
`terraform fmt -check`).

## 9. The operating rules were hopes, not controls

**The gap.** Conventions like "no secrets" or this project's "no em dashes"
rule relied on memory.

**The fix.** Mechanical enforcement: gitleaks for secrets, a CI step that
greps the tree for em and en dashes (the checker builds its pattern from
byte escapes so it does not flag itself), prettier and eslint as gates, and
a PR template whose checklist mirrors the production readiness checklist.

## What did not change

The product. AskOps answers the same questions at both tags. That is the
point: production readiness here is not features, it is the wrapper of
controls, evidence, and operability around the same modest application.
