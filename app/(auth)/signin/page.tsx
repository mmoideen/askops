import { redirect } from "next/navigation";
import { auth, authProvidersAvailable, signIn } from "../../../src/auth";

export const metadata = { title: "Sign in to AskOps" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }
  const { entra, dev } = authProvidersAvailable();

  return (
    <main className="container narrow">
      <h1>AskOps</h1>
      <p>Sign in to ask questions about internal operational documentation.</p>

      {entra && (
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="button primary">
            Sign in with Microsoft Entra ID
          </button>
        </form>
      )}

      {dev && (
        <div className="dev-signin">
          <h2>Local development sign in</h2>
          <p>
            Enabled because AUTH_DEV_BYPASS=true. This path does not exist in
            production builds.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("dev", { username: "dev-member", redirectTo: "/" });
            }}
          >
            <button type="submit" className="button">
              Sign in as dev-member (role: member)
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("dev", { username: "dev-admin", redirectTo: "/" });
            }}
          >
            <button type="submit" className="button">
              Sign in as dev-admin (role: ops_admin)
            </button>
          </form>
        </div>
      )}

      {!entra && !dev && (
        <p className="warning">
          No sign in method is configured. Set the AZURE_AD_* variables for
          Entra ID, or set AUTH_DEV_BYPASS=true for the local development path.
          See the README.
        </p>
      )}
    </main>
  );
}
