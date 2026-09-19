// Role-based access control. Shared by server code (enforcement) and client
// code (hiding actions the user can't perform). Server checks are the source
// of truth; client checks are only for a cleaner UI.

export const ADMIN_ROLES = ["super_admin", "admin", "operations", "support"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  "dashboard:view",
  "drivers:view",
  "drivers:manage",
  "drivers:review",
  "drivers:delete",
  "riders:view",
  "riders:manage",
  "rides:view",
  "pricing:view",
  "pricing:manage",
  "team:view",
  "team:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: [
    "dashboard:view",
    "drivers:view",
    "drivers:manage",
    "drivers:review",
    "drivers:delete",
    "riders:view",
    "riders:manage",
    "rides:view",
    "pricing:view",
    "pricing:manage",
    "team:view",
  ],
  operations: [
    "dashboard:view",
    "drivers:view",
    "drivers:manage",
    "drivers:review",
    "riders:view",
    "riders:manage",
    "rides:view",
    "pricing:view",
  ],
  support: ["dashboard:view", "drivers:view", "riders:view", "rides:view"],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function can(role: AdminRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: AdminRole) {
  return [...ROLE_PERMISSIONS[role]];
}
