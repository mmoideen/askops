import { NextResponse } from "next/server";
import { auth } from "./src/auth";

// Every route requires a session except the sign in page, the auth
// endpoints themselves, and the public health check. RBAC decisions happen
// server side in the API layer; this middleware only enforces that a
// session exists at the edge.

const PUBLIC_PATHS = ["/signin", "/api/auth", "/api/health"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublic || req.auth) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const signInUrl = new URL("/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
