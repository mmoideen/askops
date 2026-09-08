// The authentication gate's routing decisions, pinned. The middleware is a
// thin adapter over decideUnauthenticated, so these tests are the proof
// that a session is still required on every non public route in every
// mode, and that DEMO_MODE only changes where a missing session is sent.
import { describe, expect, it } from "vitest";
import {
  DEMO_ISSUER_PATH,
  decideUnauthenticated,
  demoRoleFromParam,
  isPublicPath,
  safeCallbackPath,
} from "../../src/auth/gate";

describe("isPublicPath", () => {
  it("allows exactly the sign in page, auth endpoints, and health", () => {
    expect(isPublicPath("/signin")).toBe(true);
    expect(isPublicPath("/api/auth/callback/demo")).toBe(true);
    expect(isPublicPath("/api/auth/demo")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/admin/audit")).toBe(false);
    expect(isPublicPath("/api/ask")).toBe(false);
    // Prefix must be a path segment, not a string prefix.
    expect(isPublicPath("/signinx")).toBe(false);
    expect(isPublicPath("/api/healthz")).toBe(false);
  });
});

describe("safeCallbackPath", () => {
  it("keeps same origin absolute paths", () => {
    expect(safeCallbackPath("/")).toBe("/");
    expect(safeCallbackPath("/admin/audit")).toBe("/admin/audit");
    expect(safeCallbackPath("/x?y=1")).toBe("/x?y=1");
  });

  it("refuses anything that could leave the origin", () => {
    expect(safeCallbackPath("https://evil.example")).toBe("/");
    expect(safeCallbackPath("//evil.example")).toBe("/");
    expect(safeCallbackPath("/\\evil.example")).toBe("/");
    expect(safeCallbackPath("javascript:alert(1)")).toBe("/");
    expect(safeCallbackPath("/ok\r\nLocation: x")).toBe("/");
    expect(safeCallbackPath("")).toBe("/");
    expect(safeCallbackPath(null)).toBe("/");
    expect(safeCallbackPath(undefined)).toBe("/");
  });

  it("never bounces back into the auth surface", () => {
    expect(safeCallbackPath("/api/auth/demo")).toBe("/");
    expect(safeCallbackPath("/signin")).toBe("/");
    expect(safeCallbackPath("/api/health")).toBe("/");
  });
});

describe("demoRoleFromParam", () => {
  it("defaults to the least privileged role", () => {
    expect(demoRoleFromParam("ops_admin")).toBe("ops_admin");
    expect(demoRoleFromParam("member")).toBe("member");
    expect(demoRoleFromParam("admin")).toBe("member");
    expect(demoRoleFromParam("OPS_ADMIN")).toBe("member");
    expect(demoRoleFromParam(null)).toBe("member");
    expect(demoRoleFromParam(undefined)).toBe("member");
  });
});

describe("decideUnauthenticated", () => {
  const modes = [{ demoActive: false }, { demoActive: true }];

  it("allows public paths and any request carrying a session, in every mode", () => {
    for (const mode of modes) {
      expect(
        decideUnauthenticated("/api/health", { hasSession: false, ...mode }),
      ).toEqual({ kind: "allow" });
      expect(decideUnauthenticated("/", { hasSession: true, ...mode })).toEqual(
        { kind: "allow" },
      );
      expect(
        decideUnauthenticated("/api/ask", { hasSession: true, ...mode }),
      ).toEqual({ kind: "allow" });
    }
  });

  it("returns 401 for unauthenticated API calls in every mode", () => {
    for (const mode of modes) {
      expect(
        decideUnauthenticated("/api/ask", { hasSession: false, ...mode }),
      ).toEqual({ kind: "unauthorized" });
      expect(
        decideUnauthenticated("/api/admin/audit", {
          hasSession: false,
          ...mode,
        }),
      ).toEqual({ kind: "unauthorized" });
    }
  });

  it("sends an unauthenticated page visit to sign in when demo is off", () => {
    expect(
      decideUnauthenticated("/admin/audit", {
        hasSession: false,
        demoActive: false,
      }),
    ).toEqual({
      kind: "redirect",
      path: "/signin",
      search: { callbackUrl: "/admin/audit" },
    });
  });

  it("sends an unauthenticated page visit through the demo issuer when demo is on", () => {
    expect(
      decideUnauthenticated("/", { hasSession: false, demoActive: true }),
    ).toEqual({
      kind: "redirect",
      path: DEMO_ISSUER_PATH,
      search: { callbackUrl: "/" },
    });
    expect(
      decideUnauthenticated("/admin/audit", {
        hasSession: false,
        demoActive: true,
      }),
    ).toEqual({
      kind: "redirect",
      path: DEMO_ISSUER_PATH,
      search: { callbackUrl: "/admin/audit" },
    });
  });
});
