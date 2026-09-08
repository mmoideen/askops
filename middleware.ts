import { NextResponse } from "next/server";
import { auth } from "./src/auth";
import { decideUnauthenticated } from "./src/auth/gate";
import { env } from "./src/config/env";

// Every route requires a session except the sign in page, the auth
// endpoints themselves, and the public health check. RBAC decisions happen
// server side in the API layer; this middleware only enforces that a
// session exists at the edge. In DEMO_MODE a missing session is issued
// automatically (as demo-member) by the demo issuer route rather than
// asked for on the sign in page. The decision logic lives in
// src/auth/gate.ts so it is unit tested.

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const decision = decideUnauthenticated(pathname, {
    hasSession: Boolean(req.auth),
    demoActive: env.DEMO_MODE,
  });
  if (decision.kind === "allow") {
    return NextResponse.next();
  }
  if (decision.kind === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const target = new URL(decision.path, req.nextUrl.origin);
  for (const [k, v] of Object.entries(decision.search)) {
    target.searchParams.set(k, v);
  }
  return NextResponse.redirect(target);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
