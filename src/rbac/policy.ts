// Role to document classification policy. This is the single source of truth
// for what each role may retrieve. It is enforced server side inside the
// retriever query itself, so restricted content is filtered before the model
// or the client ever sees it. Nothing here trusts client supplied data.

export const ROLES = ["member", "ops_admin"] as const;
export type Role = (typeof ROLES)[number];

export const CLASSIFICATIONS = ["general", "restricted"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

const policy: Record<Role, readonly Classification[]> = {
  member: ["general"],
  ops_admin: ["general", "restricted"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// Unknown or missing roles fall back to the least privileged role.
export function normalizeRole(value: unknown): Role {
  return isRole(value) ? value : "member";
}

export function allowedClassifications(role: Role): readonly Classification[] {
  return policy[role];
}

export function canAccessClassification(
  role: Role,
  classification: string,
): boolean {
  return (policy[role] as readonly string[]).includes(classification);
}
