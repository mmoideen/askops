# AskOps runbook

Operational reference for whoever is on call for AskOps, written against
the actual pipeline and workflows in this repository.

## Deploy

AskOps deploys to Vercel from the `main` branch. Three GitHub Actions
workflows gate every change:

- `.github/workflows/ci.yml`: secret scan (gitleaks), then a job running
  the em dash check, `prettier --check .`, `eslint`, `tsc --noEmit`,
  migrations against a real `pgvector/pgvector:pg16` service container,
  `npm test`, and `npm run build`.
- `.github/workflows/eval.yml`: migrates and ingests the corpus into the
  same kind of container, then runs `npm run eval` (`LLM_PROVIDER=mock`
  by default, hermetic). Gates live in `evals/gates.ts`: groundedness >=
  85 percent, refusal correctness and injection resistance both 100
  percent, citation validity >= 95 percent. A miss exits non-zero, which
  fails the workflow.
- `.github/workflows/codeql.yml`: static analysis on every push and pull
  request to `main`, plus a weekly scheduled run.

`.github/workflows/deploy-prod.yml` runs on push to `main`. It waits for
the `Lint, typecheck, test, build` check on the same commit as a second
line of defense, then runs `vercel pull`, `vercel build --prod`, and
`vercel deploy --prebuilt --prod`. It skips gracefully, noted in the job
summary, when `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID` are
not configured. In practice, nothing reaches production without passing
lint, typecheck, tests, build, the secret scan, and every eval gate;
branch protection on `main` should mark CI and the evaluation gate as
required status checks.

## Rollback

1. **Immediate**: use Vercel's instant rollback (dashboard "Instant
   Rollback" on the previous production deployment, or
   `vercel rollback <deployment-url> --token=$VERCEL_TOKEN`). This
   repoints production traffic at the last known good build with no
   rebuild, the fastest way to stop user impact.
2. **Durable fix**: `git revert <bad-commit-sha>` on `main` and push.
   Because `deploy-prod.yml` triggers on every push to `main`, this
   produces a fresh deploy of the reverted code once it clears CI and the
   eval gate again. The instant rollback buys time; the revert removes
   the bad code from the pipeline.

## Health checks

`GET /api/health` (`app/api/health/route.ts`) is unauthenticated (listed
in `middleware.ts` `PUBLIC_PATHS`). It runs `SELECT 1` against Postgres
with a 3 second timeout:

- `200 {"status":"ok","db":"up",...}` when the query succeeds.
- `503 {"status":"degraded","db":"down",...}` when it fails or times out.

Point uptime monitors and load balancer health probes at this endpoint.

## Common failures and fixes

- **Database unreachable**: `/api/health` returns 503, `db: "down"`. Ask
  requests fail inside the pipeline (retrieval and audit both hit
  Postgres) and surface as a 502 from `app/api/ask/route.ts` with body
  `{"error":"The assistant is unavailable right now. Try again
shortly."}`. Check `DATABASE_URL` and the Postgres Flexible Server's
  status and firewall rules (`infra/README.md`).
- **LLM provider errors**: any error thrown inside `runAskPipeline`
  (Anthropic API failure, timeout, bad key) is caught by the same
  try/catch and returns the identical 502. Check `ANTHROPIC_API_KEY` and
  Anthropic's status page; full detail is logged server side even though
  the user only sees the generic message.
- **Rate limit 429s**: `getRateLimiter().check()`, keyed per user, returns
  `allowed: false` past `RATE_LIMIT_PER_MINUTE` (default 20) requests per
  60 second window, returning `429` with a `Retry-After` header. Confirm a
  genuine spike versus abuse before raising the limit.
- **Ingest hash mismatches**: `scripts/ingest.ts` hashes each file's raw
  content plus the active embeddings provider name into
  `documents.contentHash`. A document that appears not to update is
  usually genuinely unchanged; run `npm run ingest` and read the console
  output (`Ingested`, `unchanged`, `removed` counts) rather than assuming.
- **Embeddings provider mismatch between ingest and query time**: the
  retriever always embeds the question with whatever
  `EMBEDDINGS_PROVIDER` is active now. If the corpus was ingested under a
  different provider since, query and stored vectors live in different
  vector spaces, so similarity becomes meaningless, a silent quality
  problem, not an error. `documents.embeddedWith` records the provider
  used per row; re-ingest if it does not match the current setting.
- **`AUTH_DEV_BYPASS` refusing to boot in production**:
  `src/config/env.ts` throws `"AUTH_DEV_BYPASS must never be enabled in
production. Refusing to start."` when that flag is true and `NODE_ENV`
  or `VERCEL_ENV` is `production`. This is by design; remove
  `AUTH_DEV_BYPASS` from the Vercel project's environment variables
  rather than work around it.

## On call steps

1. Check `GET /api/health`.
2. For a specific bad answer, get the trace id shown in the answer footer
   in the UI (`app/ask-panel.tsx`, rendered as `trace <id>`), then look it
   up in Application Insights (`OTEL_EXPORTER=azure` in production) to see
   the `ask.request`, `ask.retrieve`, and `ask.generate` spans for that
   exact request.
3. Query `audit_log` in Postgres for the same request, or for recent
   activity in general (queries below).
4. For retrieval quality complaints ("it refused" or "cited the wrong
   document"), run `npx tsx scripts/retrieval-debug.ts --question "..."
--role member` (or `ops_admin`) to see every candidate chunk and score
   with no threshold applied, or run it with no arguments to sweep the
   full eval dataset.

### Recent audit entries

```bash
psql "$DATABASE_URL" -c "
  SELECT at, user_id, role, refused, model, input_tokens, output_tokens,
         estimated_cost_micro_usd, latency_ms, trace_id
  FROM audit_log
  ORDER BY at DESC
  LIMIT 50;
"
```

### Cost per day

```bash
psql "$DATABASE_URL" -c "
  SELECT date_trunc('day', at) AS day,
         count(*) AS requests,
         sum(estimated_cost_micro_usd) / 1000000.0 AS cost_usd
  FROM audit_log
  GROUP BY 1
  ORDER BY 1 DESC;
"
```

### Cost model

Every ask records `input_tokens` and `output_tokens` from the LLM
provider's own response (`AnthropicProvider.generate`, or a character
based approximation in `MockProvider`). `estimateCostUsd()` in
`src/rag/llm.ts` multiplies those against `PRICING_PER_MTOK`, a table of
USD per million tokens keyed by model name, stored as
`estimated_cost_micro_usd` (`Math.round(costUsd * 1_000_000)`, an
integer) to avoid float drift when summed. Update `PRICING_PER_MTOK` when
list prices change; there is no other place cost is computed.

## Measured performance

Retrieval: p50 1 ms, p95 3 ms, over 50 local runs against the 20 document
corpus (71+ chunks) with local embeddings (`EMBEDDINGS_PROVIDER=local`).
End to end with the mock provider: p95 4 ms. These cover retrieval and
mock generation only; live model latency is dominated by the provider
network call. Re-measure per model with:

```bash
LLM_PROVIDER=anthropic npm run eval
```

The eval summary (`eval-results/summary.md`, also printed to the console
and written to the CI job summary) reports end to end `p50`/`p95` latency
across the full golden dataset for whichever provider ran it.
