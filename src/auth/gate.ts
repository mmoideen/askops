// Pure routing decisions for the authentication gate. Kept free of
// framework imports so the middleware's behaviour is unit testable.
//
// Every route requires a session except the sign in page, the auth
// endpoints, and the public health check. When a session is missing the
// gate decides where the visitor goes:
//
// - API routes get a 401 (no redirect games for programmatic callers).
// - In DEMO_MODE the visitor is sent through the demo issuer, which signs
//   them in as the shared, least privileged demo-member identity and returns
//   them to the page they asked for. The session is still required; it is
//   simply issued without a click. The clearance can be changed in the
//   console header afterwards.
// - Otherwise the visitor goes to the sign in page with a callback.

export const PUBLIC_PATHS = ["/signin", "/api/auth", "/api/health"] as const;

export const DEMO_ISSUER_PATH = "/api/auth/demo";

export type DemoRole = "member" | "ops_admin";

export const DEMO_IDENTITY: Record<DemoRole, string> = {
  member: "demo-member",
  ops_admin: "demo-admin",
};

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Only same origin, absolute path callbacks are honoured. Anything that
// could be read as a scheme or a protocol relative URL is discarded so the
// issuer cannot be turned into an open redirect.
export function safeCallbackPath(input: string | null | undefined): string {
  if (!input) return "/";
  if (!input.startsWith("/")) return "/";
  if (input.startsWith("//") || input.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(input)) return "/";
  // Never bounce back into the issuer or the auth endpoints.
  if (isPublicPath(input)) return "/";
  return input;
}

export function demoRoleFromParam(value: string | null | undefined): DemoRole {
  return value === "ops_admin" ? "ops_admin" : "member";
}

export type GateDecision =
  | { kind: "allow" }
  | { kind: "unauthorized" }
  | { kind: "redirect"; path: string; search: Record<string, string> };

export function decideUnauthenticated(
  pathname: string,
  opts: { hasSession: boolean; demoActive: boolean },
): GateDecision {
  if (isPublicPath(pathname) || opts.hasSession) {
    return { kind: "allow" };
  }
  if (pathname.startsWith("/api/")) {
    return { kind: "unauthorized" };
  }
  if (opts.demoActive) {
    return {
      kind: "redirect",
      path: DEMO_ISSUER_PATH,
      search: { callbackUrl: safeCallbackPath(pathname) },
    };
  }
  return {
    kind: "redirect",
    path: "/signin",
    search: { callbackUrl: pathname },
  };
}
