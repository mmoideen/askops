import { normalizeRole, type Role } from "../rbac/policy";

// Maps identity provider claims to an application role.
//
// Production: roles come from Entra ID app roles. The app registration
// defines two app roles with values "AskOps.Member" and "AskOps.OpsAdmin",
// assigned to users or groups in the tenant. Entra places granted values in
// the "roles" claim of the id token. Setup steps live in the README.
//
// Local development: the dev credentials provider (enabled only when
// AUTH_DEV_BYPASS=true outside production) supplies the role directly.

export const ENTRA_APP_ROLE_OPS_ADMIN = "AskOps.OpsAdmin";
export const ENTRA_APP_ROLE_MEMBER = "AskOps.Member";

export function roleFromEntraProfile(profile: unknown): Role {
  const claim =
    profile && typeof profile === "object" && "roles" in profile
      ? (profile as { roles?: unknown }).roles
      : undefined;
  const roles = Array.isArray(claim) ? claim.map(String) : [];
  if (roles.includes(ENTRA_APP_ROLE_OPS_ADMIN)) {
    return "ops_admin";
  }
  // Any signed in user without an explicit admin role is a member. Least
  // privilege by default.
  return normalizeRole("member");
}
