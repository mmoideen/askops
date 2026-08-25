import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "../../../src/auth";
import { db } from "../../../src/db/client";
import { auditLog } from "../../../src/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "AskOps audit log" };

// Recent audit entries, visible to ops_admin only. The role check happens
// server side here (the middleware already required a session). Questions
// in this table were PII redacted before they were persisted.

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }
  if (session.user.role !== "ops_admin") {
    return (
      <main className="container">
        <h1>Audit log</h1>
        <p className="warning">
          This view requires the ops_admin role. Your role is{" "}
          {session.user.role}.
        </p>
      </main>
    );
  }

  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.at))
    .limit(50);

  return (
    <main className="container wide">
      <h1>Audit log</h1>
      <p className="hint">
        Last {rows.length} asks. Questions are PII redacted at write time. Costs
        are estimates in USD.
      </p>
      <div className="table-scroll">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time (UTC)</th>
              <th>User</th>
              <th>Role</th>
              <th>Question</th>
              <th>Refused</th>
              <th>Injection</th>
              <th>Model</th>
              <th>Tokens in/out</th>
              <th>Cost</th>
              <th>ms</th>
              <th>Trace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.at.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td>{r.userId}</td>
                <td>{r.role}</td>
                <td className="question-cell">{r.question}</td>
                <td>{r.refused ? "yes" : ""}</td>
                <td>
                  {r.injectionFlagged ? r.injectionLabels.join(", ") : ""}
                </td>
                <td>{r.model}</td>
                <td>
                  {r.inputTokens}/{r.outputTokens}
                </td>
                <td>${(r.estimatedCostMicroUsd / 1_000_000).toFixed(4)}</td>
                <td>{r.latencyMs}</td>
                <td className="trace-cell">{r.traceId.slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
