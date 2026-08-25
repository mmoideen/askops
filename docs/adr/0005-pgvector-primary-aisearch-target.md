# ADR 0005: pgvector as the running store, Azure AI Search as the documented target

Status: accepted. Date: 2026-08-24.

## Context

The spec allows either Postgres with pgvector or Azure AI Search for
vector retrieval, and the Azure infrastructure tier is provisioned by IaC
that a reviewer may never apply. The build must be fully verifiable
locally.

## Decision

pgvector (Postgres 16, HNSW index, cosine distance) is the implementation
the app runs everywhere in this repository: local, tests, CI, and the
default deployment. Azure AI Search is implemented as a second `Retriever`
(`RETRIEVER=aisearch`) with the same contract, including server side
classification filtering via `$filter`, and the IaC documents the Postgres
tier it would replace.

## Consequences

Everything in the repo is executable and testable without an Azure
subscription, while the search service path is a config change plus an
index definition, not a rewrite. The AI Search adapter is exercised by
contract shaped tests only; live verification steps are in the runbook.
