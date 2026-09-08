import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, authProvidersAvailable, signIn, signOut } from "../src/auth";
import { DEMO_IDENTITY, type DemoRole } from "../src/auth/gate";
import { env } from "../src/config/env";
import { AskPanel } from "./ask-panel";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  const role = session.user.role;
  const operator =
    session.user.name ?? session.user.email ?? session.user.id ?? "unknown";
  const elevated = role === "ops_admin";
  const demo = authProvidersAvailable().demo;

  // Demo clearance switcher. Re-signing in through the demo credentials
  // provider replaces the session, so the boundary can be compared without
  // leaving the console. Each option is its own form with a server action;
  // no client JavaScript is involved.
  const switchTo = (target: DemoRole) => async () => {
    "use server";
    await signIn("demo", {
      username: DEMO_IDENTITY[target],
      redirectTo: "/",
    });
  };

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
            <span className="readout-k">operator</span>
            <span className="readout-v">{operator}</span>
          </div>
          <div className="readout">
            <span className="readout-k">clearance</span>
            <span
              className={`readout-v ${elevated ? "is-elevated" : ""}`.trim()}
            >
              {role}
            </span>
          </div>
          <div className="readout">
            <span className="readout-k">corpus</span>
            <span className="readout-v">northfield systems</span>
          </div>
          <div className="readout">
            <span className="readout-k">retriever</span>
            <span className="readout-v">
              {env.RETRIEVER} k={env.RETRIEVAL_TOP_K} t=
              {env.RETRIEVAL_MIN_SIMILARITY}
            </span>
          </div>
          <div className="readout">
            <span className="readout-k">model</span>
            <span className="readout-v">{env.LLM_PROVIDER}</span>
          </div>
        </div>
      </div>

      <main className="console">
        <header className="masthead rise">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div>
              <h1 className="wordmark">AskOps</h1>
              <p className="tagline">Role aware knowledge retrieval</p>
            </div>
          </div>
          <div className="identity">
            <span className="operator">{operator}</span>
            <span className={`chip chip--${role}`}>{role}</span>
            {demo && (
              <div
                className="switcher"
                role="group"
                aria-label="Switch demo clearance"
              >
                {(["member", "ops_admin"] as const).map((target) => (
                  <form
                    key={target}
                    className="stack-form"
                    action={switchTo(target)}
                  >
                    <button
                      type="submit"
                      className={`btn btn--sm ${
                        target === role ? "btn--solid" : ""
                      }`.trim()}
                      aria-pressed={target === role}
                      disabled={target === role}
                      title={
                        target === "ops_admin"
                          ? "Everything a member sees plus restricted runbooks and the audit log"
                          : "General documentation only; restricted runbooks are refused"
                      }
                    >
                      {target === "ops_admin" ? "Ops admin" : "Member"}
                    </button>
                  </form>
                ))}
              </div>
            )}
            {elevated && (
              <Link href="/admin/audit" className="btn btn--sm">
                Audit log
              </Link>
            )}
            <form
              className="stack-form"
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <button type="submit" className="btn btn--sm">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <AskPanel role={role} />

        <footer className="baseline">
          <span>Synthetic corpus, fictional company</span>
          <span>Clearance enforced in the retrieval query</span>
          <span>Every ask written to the audit log</span>
        </footer>
      </main>
    </>
  );
}
