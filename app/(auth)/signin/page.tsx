import { redirect } from "next/navigation";
import { auth, authProvidersAvailable, signIn } from "../../../src/auth";

export const metadata = { title: "Sign in to AskOps" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }
  const { entra, dev, demo } = authProvidersAvailable();

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
            <span className="readout-k">session</span>
            <span className="readout-v">unauthenticated</span>
          </div>
          <div className="readout">
            <span className="readout-k">corpus</span>
            <span className="readout-v">synthetic, fictional company</span>
          </div>
        </div>
      </div>

      <main className="console narrow gateway">
        <div className="gateway-head rise">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div>
              <h1 className="wordmark">AskOps</h1>
              <p className="tagline">Role aware knowledge retrieval</p>
            </div>
          </div>
          <p className="gateway-lede">
            An internal operations assistant that answers only from documents
            your clearance allows, cites what it used, and records every ask.
          </p>
        </div>

        {entra && (
          <section className="section rise" style={{ animationDelay: "90ms" }}>
            <div className="section-head">
              <span className="section-idx">01</span>
              <h2 className="section-title">Directory sign in</h2>
              <span className="section-rule" />
            </div>
            <form
              className="stack-form"
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: "/" });
              }}
            >
              <button type="submit" className="btn btn--solid">
                Continue with Microsoft Entra ID
              </button>
            </form>
          </section>
        )}

        {demo && (
          <section className="section rise" style={{ animationDelay: "150ms" }}>
            <div className="section-head">
              <span className="section-idx">{entra ? "02" : "01"}</span>
              <h2 className="section-title">Select clearance</h2>
              <span className="section-rule" />
            </div>
            <p className="section-note">
              This is a portfolio demo over a synthetic corpus. Pick a clearance
              and ask the same question twice to see the boundary, which is
              enforced inside the database query rather than in the interface.
            </p>
            <div className="gates">
              <form
                className="stack-form"
                action={async () => {
                  "use server";
                  await signIn("demo", {
                    username: "demo-member",
                    redirectTo: "/",
                  });
                }}
              >
                <button type="submit" className="gate">
                  <span className="gate-top">
                    <span className="gate-name">Member</span>
                    <span className="gate-arrow" aria-hidden="true">
                      &gt;
                    </span>
                  </span>
                  <span className="gate-note">
                    General operations documentation. Restricted runbooks are
                    never retrieved, so questions about them are declined
                    instead of answered from guesswork.
                  </span>
                </button>
              </form>
              <form
                className="stack-form"
                action={async () => {
                  "use server";
                  await signIn("demo", {
                    username: "demo-admin",
                    redirectTo: "/",
                  });
                }}
              >
                <button type="submit" className="gate">
                  <span className="gate-top">
                    <span className="gate-name">Ops admin</span>
                    <span className="gate-arrow" aria-hidden="true">
                      &gt;
                    </span>
                  </span>
                  <span className="gate-note">
                    Everything a member sees plus restricted incident and
                    infrastructure runbooks, and access to the audit log of
                    every ask the system has served.
                  </span>
                </button>
              </form>
            </div>
          </section>
        )}

        {dev && (
          <section className="section rise" style={{ animationDelay: "210ms" }}>
            <div className="section-head">
              <span className="section-idx">{entra || demo ? "03" : "01"}</span>
              <h2 className="section-title">Local development</h2>
              <span className="section-rule" />
            </div>
            <p className="section-note">
              Enabled because AUTH_DEV_BYPASS is true. This path refuses to boot
              in production builds.
            </p>
            <div className="gates">
              <form
                className="stack-form"
                action={async () => {
                  "use server";
                  await signIn("dev", {
                    username: "dev-member",
                    redirectTo: "/",
                  });
                }}
              >
                <button type="submit" className="btn">
                  dev-member, role member
                </button>
              </form>
              <form
                className="stack-form"
                action={async () => {
                  "use server";
                  await signIn("dev", {
                    username: "dev-admin",
                    redirectTo: "/",
                  });
                }}
              >
                <button type="submit" className="btn">
                  dev-admin, role ops_admin
                </button>
              </form>
            </div>
          </section>
        )}

        {!entra && !dev && !demo && (
          <section className="section">
            <p className="alert">
              No sign in method is configured. Set the AZURE_AD_* variables for
              Entra ID, or set AUTH_DEV_BYPASS=true for the local development
              path. See the README.
            </p>
          </section>
        )}

        <footer className="baseline">
          <span>Synthetic corpus, fictional company</span>
          <span>No real data, no account required</span>
        </footer>
      </main>
    </>
  );
}
