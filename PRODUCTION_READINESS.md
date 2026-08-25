# Production readiness checklist

Each line is marked done only if this repository actually does it, with a
one line note on how. Items that require the operator's own accounts are
marked "operator step" and documented rather than claimed.

## Deployment

- [x] Repeatable deploy pipeline: `deploy-prod.yml` promotes main to Vercel after CI; preview per PR via `deploy-preview.yml`.
- [x] Deploys skip cleanly without credentials: both workflows detect missing Vercel secrets and post a summary instead of failing.
- [x] Rollback documented: Vercel instant rollback plus `git revert`, steps in `docs/RUNBOOK.md`.
- [ ] Live production URL: operator step; requires the operator's Vercel project and Entra tenant. Placeholder `{{LIVE_URL}}` in the README.

## Configuration and secrets

- [x] Single validated configuration module: `src/config/env.ts` (zod), misconfig fails at boot.
- [x] `.env.example` documents every variable; no filled env file exists in the repo.
- [x] No secrets in the repository or its history: gitleaks scanned all commits (clean) and runs in CI on every push.
- [x] Production secret store defined: Key Vault in `infra/`, mirrored to Vercel settings (documented in `infra/README.md`).
- [x] Dangerous dev configuration cannot reach production: `AUTH_DEV_BYPASS=true` refuses to boot under production, verified by observation.

## Auth and access

- [x] OIDC sign in via Microsoft Entra ID (Auth.js v5), roles from app role claims, least privilege default.
- [x] Session required on every non public route (middleware plus in route checks).
- [x] RBAC enforced server side inside the retrieval SQL; the client and the model never see out of scope chunks.
- [x] Proven, not asserted: `tests/unit/rbac-retrieval.test.ts` (database level) and paired eval items (same question, both roles, opposite outcomes).

## Testing

- [x] 56 unit tests across policy, retrieval RBAC, guardrails, redaction, citations, pipeline, tracing, audit, and rate limiting: `npm test`.
- [x] E2E smoke suite against the production server build: `npm run test:e2e`.
- [x] CI runs the full suite against a real pgvector service container.
- [ ] First pull request green on GitHub: operator step (push the repo and open a PR; every workflow step command was run and verified locally, and all workflow files parse).

## Evaluations

- [x] Golden dataset: 24 items across grounded QA, out of scope refusal, restricted refusal, prompt injection.
- [x] Deterministic judges; results reproduce exactly in CI with no keys.
- [x] Hard gates: groundedness >= 85 percent, refusal correctness 100 percent, injection resistance 100 percent, citation validity >= 95 percent.
- [x] The gate can actually fail: verified by breaking the retrieval threshold (refusal correctness fell to 0 and the run exited 1), then restoring.
- [x] Current numbers (mock mode): groundedness 90, refusal 100, injection 100, citations 100.
- [x] Live model mode documented and wired: `workflow_dispatch` with `live=true` plus `ANTHROPIC_API_KEY` secret.

## Observability

- [x] Traces per ask with retrieval and generation child spans, token counts, estimated cost, latency: `src/observability/otel.ts`.
- [x] Exporters: console locally, Azure Monitor behind `OTEL_EXPORTER=azure`; spans force flushed per request for serverless.
- [x] Audit log: one row per ask with PII redacted question, chunk ids, injection flags, cost in micro USD, trace id.
- [x] Health endpoint `/api/health` returns 200/503 with component status.
- [x] Trace id surfaced in the UI so user reports join to telemetry.

## Error handling

- [x] Provider and pipeline failures return a friendly 502 message, never a stack trace.
- [x] Rate limited requests get 429 with Retry-After.
- [x] Invalid input gets 400 with the specific validation message.
- [x] Audit write failure does not fail the request (decision recorded in ADR 0007).

## Documentation

- [x] Architecture with trust boundaries: `docs/ARCHITECTURE.md`.
- [x] Runbook with deploy, rollback, common failures, and measured performance numbers: `docs/RUNBOOK.md`.
- [x] Threat model naming prompt injection and cross role exfiltration: `docs/THREAT_MODEL.md`.
- [x] Migration narrative: `MIGRATION.md`. Support model: `SUPPORT.md`. Security policy: `SECURITY.md`.
- [x] Decisions recorded as ADRs: `docs/adr/`.

## Support model

- [x] Severity definitions, response expectations, escalation path, and what to include in a report: `SUPPORT.md`.
- [x] On call diagnostic steps with the exact queries and scripts: `docs/RUNBOOK.md`.

## Performance and cost

- [x] Measured: retrieval p50 1 ms / p95 3 ms; full pipeline p95 4 ms with the mock provider (50 runs, local corpus). Live model latency re measured per model via the eval summary.
- [x] Token usage and estimated cost tracked per request in spans and audit rows; per day cost query in the runbook.
