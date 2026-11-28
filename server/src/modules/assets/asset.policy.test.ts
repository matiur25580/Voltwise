import { describe, expect, it } from "vitest";
import { canDeleteFacility, escapeSearchTerm, facilityHasValidParentChain } from "./asset.policy.js";

describe("facility and asset policies", () => {
  it("escapes user search text before building a Mongo regular expression", () => {
    expect(escapeSearchTerm("north.*(campus)")).toBe("north\\.\\*\\(campus\\)");
  });

  it("prevents deleting facilities that still contain assets or child facilities", () => {
    expect(canDeleteFacility(0, 0)).toBe(true);
    expect(canDeleteFacility(1, 0)).toBe(false);
    expect(canDeleteFacility(0, 1)).toBe(false);
  });

  it("rejects a parent chain that contains the current facility or a cycle", () => {
    expect(facilityHasValidParentChain(["parent-a", "parent-b"], "facility-x")).toBe(true);
    expect(facilityHasValidParentChain(["parent-a", "facility-x"], "facility-x")).toBe(false);
    expect(facilityHasValidParentChain(["parent-a", "parent-a"], "facility-x")).toBe(false);
  });
});
