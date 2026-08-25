# Support

AskOps is an internal knowledge assistant. This document describes the
support model for the people who run it and the people who use it.

## What "supported" means

This is an internally facing tool, not a customer product, and support
follows business hours triage, not 24/7 on call:

- **Total outage** (the app is unreachable, `/api/health` is returning
  503 for everyone, or every ask is failing with a 502): respond within 1
  business hour.
- **Degraded answers** (wrong refusals, missing citations, retrieval
  quality complaints, a single user's requests failing): respond by the
  next business day.

## How to get help

1. Check `GET /api/health`. A `200 {"status":"ok"}` response means the
   application and its database connection are healthy; a `503` means the
   database is unreachable.
2. Read [docs/RUNBOOK.md](docs/RUNBOOK.md) for deploy, rollback, health
   check semantics, and fixes for the failure modes seen most often
   (database unreachable, LLM provider errors, rate limiting, ingest and
   embeddings provider mismatches).
3. If you already asked a question and got a bad or unexpected answer,
   copy the trace id shown in the answer footer in the UI before you
   report it. It is the fastest way for whoever picks up the report to
   find your exact request in Application Insights and in the `audit_log`
   table.

## Escalation path

1. **App owner**: `Manish Moideen` (`mmoideen`), first point
   of contact for anything not covered by the runbook.
2. **Platform on call**: for infrastructure level issues (Postgres,
   Vercel, Azure Key Vault, Application Insights) the app owner cannot
   resolve directly, escalate to whoever holds the platform on call
   rotation for the Azure subscription and Vercel project this instance
   runs under.

## What to include in a report

- The **trace id** from the answer footer, if you have one.
- The **timestamp** the question was asked (local time is fine; it gets
  matched against `audit_log.at`, which is stored with a time zone).
- The **exact question** you asked, or as close to verbatim as you can
  reconstruct. Paraphrased questions are hard to reproduce, because
  retrieval is sensitive to phrasing.

## Known limitations

These are by design, not bugs:

- AskOps answers only from the ingested corpus (`data/corpus/`, 20
  documents at the time of writing). It has no access to outside
  knowledge, and the system prompt explicitly forbids using any.
- A refusal ("I do not have information on that in the current corpus.")
  is the expected, correct behavior when the corpus does not support an
  answer above the relevance threshold. It is not an error to report
  unless you have direct knowledge the corpus actually covers the topic.
- Restricted documents (security, credentials, and infrastructure
  procedures) are only visible to the `ops_admin` role. A `member`
  account asking about restricted material correctly receives a refusal
  or a general-only answer, never restricted content.
