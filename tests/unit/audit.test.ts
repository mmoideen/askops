import { like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, sqlClient } from "../../src/db/client";
import { auditLog } from "../../src/db/schema";
import { writeAuditEntry } from "../../src/observability/audit";

afterAll(async () => {
  await db.delete(auditLog).where(like(auditLog.userId, "test-audit-%"));
  await sqlClient.end();
});

describe("audit log", () => {
  it("persists one row per ask with PII redacted from the question", async () => {
    const userId = `test-audit-${Date.now()}`;
    await writeAuditEntry({
      userId,
      role: "member",
      question:
        "Can you email jane.doe@northfield.example about my card 4111 1111 1111 1111?",
      refused: false,
      retrievedChunkIds: [1, 2, 3],
      citedChunkIds: [1],
      injectionFlagged: true,
      injectionLabels: ["reveal-system-prompt"],
      model: "mock",
      inputTokens: 120,
      outputTokens: 45,
      estimatedCostUsd: 0.00069,
      latencyMs: 321,
      traceId: "abc123",
    });

    const rows = await db
      .select()
      .from(auditLog)
      .where(like(auditLog.userId, userId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.question).toContain("[REDACTED_EMAIL]");
    expect(row.question).toContain("[REDACTED_CARD]");
    expect(row.question).not.toContain("jane.doe@northfield.example");
    expect(row.retrievedChunkIds).toEqual([1, 2, 3]);
    expect(row.citedChunkIds).toEqual([1]);
    expect(row.injectionFlagged).toBe(true);
    expect(row.injectionLabels).toEqual(["reveal-system-prompt"]);
    expect(row.estimatedCostMicroUsd).toBe(690);
    expect(row.latencyMs).toBe(321);
    expect(row.traceId).toBe("abc123");
  });

  it("does not throw when the insert fails", async () => {
    // Force a failure with an oversized integer; the helper must swallow it.
    await expect(
      writeAuditEntry({
        userId: `test-audit-fail-${Date.now()}`,
        role: "member",
        question: "q",
        refused: false,
        retrievedChunkIds: [],
        citedChunkIds: [],
        injectionFlagged: false,
        injectionLabels: [],
        model: "mock",
        inputTokens: Number.MAX_SAFE_INTEGER,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: 0,
        traceId: "t",
      }),
    ).resolves.toBeUndefined();
  });
});
