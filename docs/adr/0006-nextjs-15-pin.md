# ADR 0006: Pin Next.js 15 although Next.js 16 is available

Status: accepted. Date: 2026-08-24.

## Context

The project specification pins Next.js 15 with React 19. At build time,
Next.js 16 is the latest major. The spec allows deviation only for hard
blockers, and there is none: 15.5.x is maintained and fully supports the
App Router, route handlers, middleware, and the instrumentation hook this
app uses.

## Decision

Stay on Next.js 15.5.x per the spec. Revisit on the normal dependency
update cadence (Dependabot raises majors; the upgrade is a deliberate PR,
not an automatic one).

## Consequences

No churn against the spec, and the upgrade path is clean: the APIs used
here are stable across 15 and 16. The pin is explicit in package.json, so
the decision is visible where it takes effect.
