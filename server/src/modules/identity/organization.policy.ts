import type { Role } from "./identity.types.js";

export type AssignableRole = Exclude<Role, "owner">;

export function canInviteRole(actorRole: Role, invitedRole: AssignableRole): boolean {
  return actorRole === "owner" || (actorRole === "admin" && invitedRole !== "admin");
}

export function canAssignRole(actorRole: Role, nextRole: Role): boolean {
  if (nextRole === "owner") return actorRole === "owner";
  if (actorRole === "admin" && nextRole === "admin") return false;
  return actorRole === "owner" || actorRole === "admin";
}

export function canManageOwner(actorRole: Role, activeOwnerCount: number): boolean {
  return actorRole === "owner" && activeOwnerCount > 1;
}
