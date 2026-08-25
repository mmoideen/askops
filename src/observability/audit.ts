import { db } from "../db/client";
import { auditLog } from "../db/schema";
import { redactPii } from "../rag/guardrails";

// The audit log answers "who asked what, what did they receive, and what
// did it cost" from a single queryable table. Questions pass through PII
// redaction before persisting. Chunk ids rather than chunk text are stored,
// so the log itself never duplicates restricted content.
//
// A failed audit write is logged and does not fail the user request. That
// trade off (availability over audit completeness) is recorded in the
// threat model; the trace pipeline provides a second, independent record.

export interface AuditEntry {
  userId: string;
  role: string;
  question: string;
  refused: boolean;
  retrievedChunkIds: number[];
  citedChunkIds: number[];
  injectionFlagged: boolean;
  injectionLabels: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  traceId: string;
}

export async function writeAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: entry.userId,
      role: entry.role,
      question: redactPii(entry.question),
      refused: entry.refused,
      retrievedChunkIds: entry.retrievedChunkIds,
      citedChunkIds: entry.citedChunkIds,
      injectionFlagged: entry.injectionFlagged,
      injectionLabels: entry.injectionLabels,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      estimatedCostMicroUsd: Math.round(entry.estimatedCostUsd * 1_000_000),
      latencyMs: entry.latencyMs,
      traceId: entry.traceId,
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}
