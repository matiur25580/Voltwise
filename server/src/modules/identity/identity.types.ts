export const roles = ["owner", "admin", "operator", "analyst", "viewer"] as const;
export type Role = typeof roles[number];

export const permissions = [
  "organization:read", "organization:update", "members:read", "members:manage",
  "energy:read", "energy:write", "assets:manage", "reports:read", "billing:manage"
] as const;
export type Permission = typeof permissions[number];

export const rolePermissions: Record<Role, Permission[]> = {
  owner: [...permissions],
  admin: permissions.filter((permission) => permission !== "billing:manage"),
  operator: ["organization:read", "members:read", "energy:read", "energy:write", "assets:manage", "reports:read"],
  analyst: ["organization:read", "members:read", "energy:read", "reports:read"],
  viewer: ["organization:read", "energy:read", "reports:read"]
};
