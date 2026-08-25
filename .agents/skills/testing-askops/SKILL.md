---
name: testing-askops
description: How to run and test AskOps locally (quickstart env, eval, e2e, dev sign-in golden path)
---

# Testing AskOps locally

## Services
- Postgres+pgvector via `docker compose up -d` (container `askops-postgres`, host port 5433).
- Quickstart `.env`: `LLM_PROVIDER=mock`, `EMBEDDINGS_PROVIDER=local`, `AUTH_DEV_BYPASS=true`, `DATABASE_URL=postgres://postgres:postgres@localhost:5433/askops`.
- IMPORTANT: `AUTH_SECRET` in `.env` must be non-empty or every sign-in (including the dev bypass) fails with a NextAuth `MissingSecret` 500. Generate with `openssl rand -base64 32`.
- Migrations: `npm run db:migrate`; corpus: `npm run ingest`.

## Key commands
- `npm run eval` — offline eval; with the PR #14 fix it loads `.env` via `tsx --env-file-if-exists=.env` and should report `llm=mock` and `Overall: PASS` without any exported vars.
- `npm run test:e2e` — Playwright builds and runs `next start` itself; its webServer env forces `AUTH_DEV_BYPASS="false"` (production server refuses to boot with the bypass on). Make sure nothing else is on port 3000 unless you want `reuseExistingServer` behavior.
- `npm run dev` — dev server on http://localhost:3000.

## Golden path (browser)
- `/signin` shows "Sign in as dev-member (role: member)" and "Sign in as dev-admin (role: ops_admin)" buttons when `AUTH_DEV_BYPASS=true`.
- Grounded question: "How do I set up the GlobalConnect VPN?" → "Answer" heading, `[n]` citations, Sources list with `cited` badge.
- Role boundary: "What is the database failover procedure?" → dev-member gets "No answer available" refusal (no sources); dev-admin gets an answer sourced from `database-failover-procedure` / `backup-restore-runbook`.
- dev-admin sees an "Audit log" link → `/admin/audit` table (Time/User/Role/Question/Refused/...); asks appear there immediately.
- The Next.js dev-overlay "N issues" badge can appear bottom-left; dismiss via its X before recording.

## Devin Secrets Needed
- None for the mock/local quickstart path. Anthropic/OpenAI/Azure keys only needed for non-mock providers.
