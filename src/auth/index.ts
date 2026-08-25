import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { env } from "../config/env";
import { normalizeRole } from "../rbac/policy";
import { roleFromEntraProfile } from "./roles";

// Auth.js (NextAuth v5) configuration.
//
// Providers:
// - Microsoft Entra ID (OIDC) when the AZURE_AD_* variables are set. This is
//   the production sign in path. Roles come from Entra app role claims.
// - A dev credentials provider, ONLY when AUTH_DEV_BYPASS=true and the
//   runtime is not production (env.ts refuses to boot otherwise). It exists
//   so the full auth and RBAC flow is exercisable locally without a tenant.
//   It accepts exactly two fixed users and no passwords, and it is not
//   registered at all unless the bypass is on.
// - A demo credentials provider when DEMO_MODE=true: two fixed demo
//   identities so a public portfolio deployment is explorable, including
//   the role boundary, over the synthetic corpus. Allowed in production on
//   purpose; the threat model documents the trade offs.

const DEV_USERS: Record<
  string,
  { id: string; name: string; email: string; role: "member" | "ops_admin" }
> = {
  "dev-member": {
    id: "dev-member",
    name: "Dev Member",
    email: "dev-member@askops.local",
    role: "member",
  },
  "dev-admin": {
    id: "dev-admin",
    name: "Dev Admin",
    email: "dev-admin@askops.local",
    role: "ops_admin",
  },
};

const DEMO_USERS: Record<
  string,
  { id: string; name: string; email: string; role: "member" | "ops_admin" }
> = {
  "demo-member": {
    id: "demo-member",
    name: "Demo Member",
    email: "demo-member@askops.demo",
    role: "member",
  },
  "demo-admin": {
    id: "demo-admin",
    name: "Demo Ops Admin",
    email: "demo-admin@askops.demo",
    role: "ops_admin",
  },
};

const entraConfigured = Boolean(
  env.AZURE_AD_CLIENT_ID &&
  env.AZURE_AD_CLIENT_SECRET &&
  env.AZURE_AD_TENANT_ID,
);

const devBypassActive = env.AUTH_DEV_BYPASS && env.NODE_ENV !== "production";

const demoActive = env.DEMO_MODE;

const providers: NextAuthConfig["providers"] = [];

if (entraConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId: env.AZURE_AD_CLIENT_ID,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  );
}

if (devBypassActive) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Local development sign in",
      credentials: {
        username: {
          label: "Dev user",
          type: "text",
          placeholder: "dev-member or dev-admin",
        },
      },
      authorize(credentials) {
        const username = String(credentials?.username ?? "");
        const user = DEV_USERS[username];
        return user ?? null;
      },
    }),
  );
}

if (demoActive) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo sign in",
      credentials: {
        username: {
          label: "Demo user",
          type: "text",
          placeholder: "demo-member or demo-admin",
        },
      },
      authorize(credentials) {
        const username = String(credentials?.username ?? "");
        const user = DEMO_USERS[username];
        return user ?? null;
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user, profile, account }) {
      // First sign in: resolve and pin the role onto the token.
      if (user) {
        if (
          (account?.provider === "dev" || account?.provider === "demo") &&
          "role" in user
        ) {
          token.role = normalizeRole((user as { role?: string }).role);
        } else if (profile) {
          token.role = roleFromEntraProfile(profile);
        } else {
          token.role = "member";
        }
        token.uid = user.id ?? token.sub ?? "unknown";
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = normalizeRole(token.role);
      session.user.id = String(token.uid ?? token.sub ?? "unknown");
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export function authProvidersAvailable(): {
  entra: boolean;
  dev: boolean;
  demo: boolean;
} {
  return { entra: entraConfigured, dev: devBypassActive, demo: demoActive };
}
