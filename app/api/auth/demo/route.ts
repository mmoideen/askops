import { NextResponse, type NextRequest } from "next/server";
import { authProvidersAvailable, signIn } from "../../../../src/auth";
import {
  DEMO_IDENTITY,
  demoRoleFromParam,
  safeCallbackPath,
} from "../../../../src/auth/gate";

// Demo session issuer. Exists only when DEMO_MODE is on; otherwise it is a
// 404 and the middleware never sends anyone here. Signs the visitor in as
// one of the two fixed demo identities (member by default) and returns
// them to a same origin path. Accepts role=ops_admin or role=member for a
// direct link into either clearance; the console header's switcher uses a
// server action against the same provider rather than this route.
//
// This is a static route, so it takes precedence over the Auth.js
// catch all at /api/auth/[...nextauth].

export const dynamic = "force-dynamic";

async function issue(
  req: NextRequest,
  role: string | null,
  callback: string | null,
) {
  if (!authProvidersAvailable().demo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const username = DEMO_IDENTITY[demoRoleFromParam(role)];
  const redirectTo = safeCallbackPath(callback);
  // signIn() sets the session cookie and throws a Next.js redirect to
  // redirectTo. Nothing after this line runs on the success path.
  await signIn("demo", { username, redirectTo });
  return NextResponse.redirect(new URL(redirectTo, req.nextUrl.origin));
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  return issue(req, params.get("role"), params.get("callbackUrl"));
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const role = form?.get("role");
  const callback = form?.get("callbackUrl");
  return issue(
    req,
    typeof role === "string" ? role : null,
    typeof callback === "string" ? callback : null,
  );
}
