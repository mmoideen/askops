# ADR 0001: Record architecture decisions

Status: accepted. Date: 2026-08-24.

## Context

This project makes deliberate trade offs (provider choices, deviations from
the original spec, security postures) that a future maintainer or reviewer
should be able to reconstruct without archaeology.

## Decision

Keep architecture decision records in `docs/adr/`, numbered, in the style
of Michael Nygard's ADRs: context, decision, consequences. Any deviation
from the project specification gets an ADR.

## Consequences

Decisions are reviewable in pull requests alongside the code that
implements them. The set of ADRs doubles as an onboarding reading list.
