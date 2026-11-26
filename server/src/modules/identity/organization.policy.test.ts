import { describe, expect, it } from "vitest";
import { canAssignRole, canInviteRole, canManageOwner } from "./organization.policy.js";

describe("organization role policy", () => {
  it("allows owners to invite every non-owner role", () => {
    expect(canInviteRole("owner", "admin")).toBe(true);
    expect(canInviteRole("owner", "operator")).toBe(true);
    expect(canInviteRole("owner", "analyst")).toBe(true);
    expect(canInviteRole("owner", "viewer")).toBe(true);
  });

  it("prevents admins from inviting administrators", () => {
    expect(canInviteRole("admin", "admin")).toBe(false);
    expect(canInviteRole("admin", "operator")).toBe(true);
  });

  it("prevents non-owners from assigning owner or admin roles", () => {
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("owner", "owner")).toBe(true);
  });

  it("does not allow operator, analyst, or viewer roles to administer members", () => {
    for (const role of ["operator", "analyst", "viewer"] as const) {
      expect(canAssignRole(role, "viewer")).toBe(false);
    }
  });

  it("protects the final owner and reserves owner management for owners", () => {
    expect(canManageOwner("owner", 1)).toBe(false);
    expect(canManageOwner("owner", 2)).toBe(true);
    expect(canManageOwner("admin", 2)).toBe(false);
  });
});
