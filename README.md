# AskOps

An internal knowledge assistant, built twice on purpose.

Employees ask questions in natural language and get grounded answers with
citations, drawn only from documents their role allows them to see. The
assistant refuses when the corpus does not support an answer. The
application is intentionally modest. The point of this repository is the
transformation around it: the same product exists here as a tagged, working
but unsafe prototype (`v0.1-prototype`) and as a tagged production system
(`v1.0-production`), with every gap closed in reviewable commits.

Live instance: `{{LIVE_URL}}` (placeholder until deployed).

_Screenshot placeholder: capture the ask flow with citations after the
first deploy and save it as `docs/screenshot.png`, then embed it here._

## The story in one table

| Concern        | v0.1-prototype                                       | v1.0-production                                                                                                            |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Retrieval      | Top 5 chunks, no threshold, everyone sees everything | Role scoped in SQL, relevance threshold, refusal instead of guessing                                                       |
| Auth           | None                                                 | Entra ID (OIDC) via Auth.js, roles from app role claims, dev path that refuses to exist in production                      |
| Access control | None                                                 | `member` vs `ops_admin` mapped to document classifications, enforced inside the retriever query, proven by tests and evals |
| Input handling | `body.question`, unchecked                           | zod validation, length bounds, injection heuristics flagged to the audit log                                               |
| Prompting      | String concatenation                                 | Hardened system prompt, retrieved content delimited and labeled untrusted, user text never in the system prompt            |
| Secrets        | `process.env` scattered, hardcoded fallbacks         | One validated env module, `.env.example` shape, gitleaks in CI, Key Vault in the IaC                                       |
| Observability  | `console.log`, nothing else                          | Request, retrieve, and generate spans with token and cost attributes; console locally, Azure Monitor in production         |
| Audit          | None                                                 | One queryable row per ask: who, what (PII redacted), which chunks, cost, latency, trace id                                 |
| Rate limiting  | None                                                 | Per user sliding window, in memory locally, Postgres on serverless                                                         |
| Testing        | None                                                 | 56 unit tests (including RBAC proofs against a real database) plus an e2e smoke suite                                      |
| Evaluations    | None                                                 | 24 item golden dataset, deterministic judges, four gate metrics that fail the pipeline                                     |
| CI/CD          | None                                                 | Lint, typecheck, tests, build, secret scan, CodeQL, eval gate, graceful skip deploys                                       |
| Infrastructure | Hand run docker compose                              | The same Azure footprint in both Bicep and Terraform, validated                                                            |
| Ingestion      | Truncate and reload                                  | Content hashed, idempotent, heading aware chunking, automatic re embed on provider change                                  |
| Docs           | 12 line README                                       | Architecture, runbook, threat model, migration story, readiness checklist, support model, ADRs                             |

Read [MIGRATION.md](MIGRATION.md) for the full gap by gap narrative and
[PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the checklist this
repository actually passed. Compare the endpoints yourself:

```bash
git log --oneline v0.1-prototype
git diff --stat v0.1-prototype v1.0-production
```

## Quickstart (local)

Requirements: Node 22, Docker.

```bash
cp .env.example .env      # defaults work for a keyless local run
docker compose up -d      # Postgres 16 + pgvector on host port 5433
npm install
npm run db:migrate
npm run ingest            # 20 synthetic ops docs, idempotent
```

For a keyless run, set `LLM_PROVIDER=mock` and `AUTH_DEV_BYPASS=true` in
`.env`, then:

```bash
npm run dev
```

Sign in at http://localhost:3000 as `dev-member` or `dev-admin` and ask
"How do I set up the GlobalConnect VPN?". The two dev users demonstrate the
role boundary: ask both users about the database failover procedure and
compare the results. With a real key, set `ANTHROPIC_API_KEY` and
`LLM_PROVIDER=anthropic` for model generated answers (default model:
`claude-sonnet-5`).

Verify everything the way CI does:

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run eval              # the deploy gate: exits non zero on any gate miss
```

## Production controls implemented

- Authentication on every route except sign in and health, with RBAC
  enforced server side inside the retrieval query. A `member` cannot
  retrieve restricted chunks; a unit test and eval items prove it.
- Guardrails: validated input, hardened prompt with delimited untrusted
  context, injection heuristics recorded to the audit log, PII redaction on
  persisted questions, per user rate limiting.
- Observability: OpenTelemetry traces per ask (retrieval and generation
  spans with token and cost attributes), a queryable audit table, a health
  endpoint, and a trace id surfaced in the UI for support.
- An evaluation harness with hard gates (groundedness >= 85 percent,
  refusal correctness 100 percent, injection resistance 100 percent,
  citation validity >= 95 percent) wired to fail CI before promotion.
- CI/CD with secret scanning, CodeQL, Dependabot, and deploys that skip
  cleanly when credentials are absent.
- Infrastructure as code for the Azure tier in both Bicep and Terraform,
  both validated.

## Production deployment shape

The app deploys to Vercel. Azure hosts the data, secrets, and telemetry
tier, provisioned from [infra/](infra/README.md). Secrets live in Key Vault
and are mirrored into Vercel project settings; the app reads only
environment variables. Entra ID app roles `AskOps.Member` and
`AskOps.OpsAdmin` map to the two application roles (setup steps in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

## Repository map

| Path                 | What it is                                                      |
| -------------------- | --------------------------------------------------------------- |
| `src/rag/`           | Retriever, embeddings, and LLM interfaces plus the ask pipeline |
| `src/rbac/`          | The role to classification policy                               |
| `src/auth/`          | Auth.js config, Entra ID provider, role mapping                 |
| `src/observability/` | Tracing setup and the audit writer                              |
| `evals/`             | Golden dataset, judges, gate thresholds                         |
| `scripts/`           | Ingest, eval runner, retrieval debugger, em dash check          |
| `infra/`             | Bicep and Terraform for the Azure tier                          |
| `docs/`              | Architecture, runbook, threat model, ADRs                       |
| `data/corpus/`       | 20 synthetic internal ops documents (fictional company)         |

Maintained by `Manish Moideen` (`mmoideen`). See
[SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).
