# ADR 0003: A deterministic mock LLM makes tests, CI, and evals hermetic

Status: accepted. Date: 2026-08-24.

## Context

The test suite and the eval harness must run in CI without live cloud
dependencies or provider keys, and the eval gate must produce identical
results on every run of the same commit. Recording and replaying real
provider responses (a fixtures cassette) is an alternative, but cassettes
go stale, hide prompt changes, and still need a live key to record.

## Decision

The `LlmProvider` interface has a `mock` implementation that honors the
same output contract as the real provider: extractive answers drawn only
from the supplied context chunks, `[n]` citations, and the canonical
refusal phrase when it has no context. `LLM_PROVIDER=mock` selects it; CI
sets this explicitly. The eval gates are computed by deterministic judges
(refusal, citation validity, keyword supported groundedness, scope and
leak checks), so gate results are reproducible byte for byte. An optional
LLM judge adds a supplementary groundedness opinion in live runs but never
affects gates.

## Consequences

CI is hermetic and fast. The mock cannot measure real model answer
quality; the documented live mode (`LLM_PROVIDER=anthropic`, optionally
`EVAL_LLM_JUDGE=true`) exists for that, runnable on demand in the eval
workflow with a repository secret. The mock also cannot exhibit prompt
following failures, which is why injection resistance rests on structural
controls (SQL scoped retrieval, delimited context) that the judges verify
directly.
