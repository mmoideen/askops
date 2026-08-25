# ADR 0004: Rate limiting with a pluggable store, Postgres in production

Status: accepted. Date: 2026-08-24.

## Context

The ask endpoint needs per user rate limiting. The app deploys to Vercel
serverless, where instances neither share memory nor live long, so an in
memory token bucket silently under enforces in production. A shared store
is required, and the usual answer (Redis) would add a service to
provision, secure, and pay for.

## Decision

A `RateLimiter` interface with two stores selected by `RATE_LIMIT_STORE`:
`memory` (correct for a single long lived process: local dev, tests) and
`postgres` (a sliding window over a `rate_limit_events` table in the
database the app already has, pruned opportunistically on each check).

## Consequences

No new infrastructure. The Postgres path adds two or three small queries
per ask, acceptable at internal tool traffic. Under a concurrent race the
window can overshoot by a request or two; the limit exists to stop abuse,
not to meter billing, so this is accepted and documented. If traffic ever
outgrows this, the interface swaps to a Redis implementation without
touching callers.
