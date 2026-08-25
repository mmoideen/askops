import { desc } from "drizzle-orm";
import Link from "next/link";
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
      <main className="console">
        <header className="masthead">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div>
              <h1 className="wordmark">Audit log</h1>
              <p className="tagline">Restricted view</p>
            </div>
          </div>
          <Link href="/" className="btn btn--sm">
            Back to console
          </Link>
        </header>
        <section className="section">
          <p className="alert">
            This view requires the ops_admin role. Your clearance is{" "}
            {session.user.role}.
          </p>
        </section>
      </main>
    );
  }

  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.at))
    .limit(50);

  return (
    <>
      <div className="rail">
        <div className="rail-inner">
          <div className="readout">
            <span className="led" aria-hidden="true" />
            <span className="readout-k">sys</span>
            <span className="readout-v is-live">online</span>
          </div>
          <div className="readout">
            <span className="readout-k">view</span>
            <span className="readout-v is-elevated">audit log</span>
          </div>
          <div className="readout">
            <span className="readout-k">window</span>
            <span className="readout-v">last {rows.length} asks</span>
          </div>
          <div className="readout">
            <span className="readout-k">questions</span>
            <span className="readout-v">pii redacted at write</span>
          </div>
        </div>
      </div>

      <main className="console wide">
        <header className="masthead rise">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div>
              <h1 className="wordmark">Audit log</h1>
              <p className="tagline">Every ask, every decision, every cost</p>
            </div>
          </div>
          <div className="identity">
            <span className="chip chip--ops_admin">ops_admin</span>
            <Link href="/" className="btn btn--sm">
              Back to console
            </Link>
          </div>
        </header>

        <section className="section rise" style={{ animationDelay: "90ms" }}>
          <div className="section-head">
            <span className="section-idx">01</span>
            <h2 className="section-title">Telemetry</h2>
            <span className="section-rule" />
          </div>
          <p className="section-note">
            Written on every ask, including refusals. Questions are PII redacted
            before they are persisted and costs are estimates in USD. Trace ids
            match the identifier returned to the caller.
          </p>

          <div className="log-scroll">
            {rows.length === 0 ? (
              <p className="log-empty">No asks recorded yet.</p>
            ) : (
              <table className="log">
                <thead>
                  <tr>
                    <th>Time (UTC)</th>
                    <th>User</th>
                    <th>Clearance</th>
                    <th>Question</th>
                    <th>Flags</th>
                    <th>Model</th>
                    <th className="col-num">Tok in/out</th>
                    <th className="col-num">Cost</th>
                    <th className="col-num">ms</th>
                    <th>Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.at.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td>{r.userId}</td>
                      <td>{r.role}</td>
                      <td className="col-q">{r.question}</td>
                      <td className="col-flags">
                        {r.refused && (
                          <span className="flag flag--deny">withheld</span>
                        )}
                        {r.injectionFlagged && (
                          <span className="flag flag--inject">
                            {r.injectionLabels.join(", ")}
                          </span>
                        )}
                      </td>
                      <td>{r.model}</td>
                      <td className="col-num">
                        {r.inputTokens}/{r.outputTokens}
                      </td>
                      <td className="col-num">
                        ${(r.estimatedCostMicroUsd / 1_000_000).toFixed(4)}
                      </td>
                      <td className="col-num">{r.latencyMs}</td>
                      <td className="col-trace">{r.traceId.slice(0, 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <footer className="baseline">
          <span>Audit writes fail open by design, see ADR 0007</span>
          <span>Retention and export are documented in the runbook</span>
        </footer>
      </main>
    </>
  );
}
