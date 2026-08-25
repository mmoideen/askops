# ADR 0007: Audit writes fail open, with the trace pipeline as backstop

Status: accepted. Date: 2026-08-24.

## Context

Every ask writes an audit row. If that insert fails (connection blip,
storage incident), the request could either fail closed (reject the user's
question because it cannot be audited) or fail open (serve the answer and
record the audit failure elsewhere). Regulated environments often demand
provable access records, which argues for fail closed; an internal
knowledge tool argues for availability.

## Decision

Fail open: a failed audit insert logs an error and does not fail the user
request. Two mitigations keep the record trustworthy: the same request
data is emitted as span attributes through the tracing pipeline (an
independent sink), and audit write failures are themselves visible in
logs and traces for alerting.

## Consequences

A database incident cannot take question answering down with it, at the
cost of possible audit gaps during such an incident, bounded by the trace
record. If this system ever handled data where access proof is a legal
requirement rather than an operational one, this decision should be
reversed and the trade documented in the threat model.
