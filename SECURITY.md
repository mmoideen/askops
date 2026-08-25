# Security policy

## Reporting a vulnerability

Email `{{AUTHOR_NAME}}` directly rather than opening a public GitHub
issue. Security reports filed as public issues expose the vulnerability
to every other reader before a fix ships, so please keep the initial
report private. Include what you found, the steps to reproduce it, and
its apparent impact (which asset from
[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) it affects: the corpus, the
audit log, session tokens, provider keys, or the system prompt).

You should expect an acknowledgement within 3 business days. This is a
portfolio project maintained by one person, `{{AUTHOR_NAME}}`
(`{{GITHUB_USERNAME}}`), not a funded security team, so please set your
expectations for fix turnaround accordingly, and say so in your report if
your finding is time sensitive.

## Supported versions

Only the `main` branch (equivalently, the `v1.0-production` tag) receives
fixes. The `v0.1-prototype` tag is preserved intentionally, as a
historical, deliberately unsafe snapshot for side by side comparison with
the production version, described in the repository README. Do not
deploy `v0.1-prototype` anywhere reachable, and do not report its known
gaps as new findings; they are the point of the comparison.

## Security controls

- **Entra ID OIDC authentication**: Microsoft Entra ID via Auth.js
  (`src/auth/index.ts`) is the production sign in path; app role claims
  map to the two internal roles (`src/auth/roles.ts`).
- **Server side RBAC in SQL**: the role to classification policy
  (`src/rbac/policy.ts`) is enforced inside the retriever's `WHERE`
  clause (`src/rag/retriever.pgvector.ts`), not filtered after the fact.
- **Zod input validation**: every request body and every environment
  variable is validated against a schema before use
  (`src/rag/guardrails.ts`, `src/config/env.ts`).
- **Prompt injection defenses**: delimited untrusted context, a hardened
  system prompt that refuses on override attempts, and heuristic
  detection flagged to the audit log (`src/rag/prompt.ts`,
  `src/rag/guardrails.ts`).
- **PII redaction in logs**: questions are passed through `redactPii()`
  (emails, SSNs, phone numbers, credit card numbers) before they are
  persisted to `audit_log` (`src/observability/audit.ts`).
- **Per user rate limiting**: a 60 second sliding window keyed by
  authenticated user id, backed by memory locally or Postgres in
  serverless deployments (`src/ratelimit/limiter.ts`).
- **Secret scanning in CI**: gitleaks runs on every push and pull request
  (`.github/workflows/ci.yml`, `.gitleaks.toml`).
- **CodeQL**: static analysis for JavaScript and TypeScript on every push
  and pull request to `main`, plus a weekly scheduled scan
  (`.github/workflows/codeql.yml`).
- **Dependency updates via Dependabot**: weekly grouped updates for npm
  and GitHub Actions dependencies.
- **No secrets in the repository**: `.env.example` ships with every
  value blank; real values live in Key Vault in production
  (`infra/README.md`) and are never committed.
- **Audit logging**: one row per ask in `audit_log`, recording who asked
  what (PII redacted), which chunks were retrieved and cited, cost,
  latency, and trace id (`src/observability/audit.ts`).
- **Dev bypass hard blocked in production**: `AUTH_DEV_BYPASS=true` under
  a production-like environment makes the application refuse to boot
  (`src/config/env.ts`), rather than being merely disabled at runtime.
