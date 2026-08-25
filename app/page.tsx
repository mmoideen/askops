import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "../src/auth";
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
