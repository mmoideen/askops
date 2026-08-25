import { redirect } from "next/navigation";
import { auth, signOut } from "../src/auth";
import { AskPanel } from "./ask-panel";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <main className="container">
      <header className="topbar">
        <div>
          <h1>AskOps</h1>
          <p className="subtitle">Internal knowledge assistant</p>
        </div>
        <div className="identity">
          <span>
            {session.user.name ?? session.user.email ?? session.user.id}
          </span>
          <span className={`role-badge role-${session.user.role}`}>
            {session.user.role}
          </span>
          {session.user.role === "ops_admin" && (
            <a href="/admin/audit" className="button small">
              Audit log
            </a>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button type="submit" className="button small">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <AskPanel role={session.user.role} />
    </main>
  );
}
