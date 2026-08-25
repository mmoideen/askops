import { describe, expect, it } from "vitest";
import {
  allowedClassifications,
  canAccessClassification,
  isRole,
  normalizeRole,
} from "../../src/rbac/policy";

describe("rbac policy", () => {
  it("member can only access general", () => {
    expect(allowedClassifications("member")).toEqual(["general"]);
    expect(canAccessClassification("member", "general")).toBe(true);
    expect(canAccessClassification("member", "restricted")).toBe(false);
  });

  it("ops_admin can access general and restricted", () => {
    expect(allowedClassifications("ops_admin")).toEqual([
      "general",
      "restricted",
    ]);
    expect(canAccessClassification("ops_admin", "restricted")).toBe(true);
  });

  it("unknown roles normalize to the least privileged role", () => {
    expect(normalizeRole("superuser")).toBe("member");
    expect(normalizeRole(undefined)).toBe("member");
    expect(normalizeRole(42)).toBe("member");
    expect(normalizeRole("ops_admin")).toBe("ops_admin");
  });

  it("isRole accepts only known roles", () => {
    expect(isRole("member")).toBe(true);
    expect(isRole("ops_admin")).toBe(true);
    expect(isRole("root")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
