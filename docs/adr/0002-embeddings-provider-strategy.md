# ADR 0002: Embeddings behind an interface with a deterministic local default

Status: accepted. Date: 2026-08-24.

## Context

The LLM provider is Anthropic, but Anthropic does not offer an embeddings
API. The spec calls for a hosted embeddings provider selected by env plus a
deterministic local fallback for tests. pgvector columns have a fixed
dimension, so mixing providers with different dimensions in one column is
not possible.

## Decision

An `EmbeddingsProvider` interface with two implementations, both emitting
1536 dimensions so a single `vector(1536)` column serves either:

- `local`: a dependency free feature hashing embedder (FNV-1a over tokens
  and token bigrams, signed, L2 normalized). Deterministic, keyless, good
  enough for keyword heavy retrieval over a small operational corpus. The
  default for dev, tests, and CI.
- `openai`: `text-embedding-3-small` (natively 1536 dims) called over
  plain fetch, keeping the dependency surface small.

Ingest records which provider embedded each document (`embedded_with`), and
hashes provider name into the content hash, so switching providers
automatically re embeds on the next ingest run.

## Consequences

CI and the eval suite run with zero live keys. Retrieval quality with the
local embedder is lexical rather than semantic; the eval gates are
calibrated against it, and live runs with a hosted embedder can only
improve recall. Query time embedding must use the same provider the corpus
was ingested with; the runbook documents this.
