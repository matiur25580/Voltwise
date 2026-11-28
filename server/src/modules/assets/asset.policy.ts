export function escapeSearchTerm(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function canDeleteFacility(assetCount: number, childFacilityCount: number): boolean {
  return assetCount === 0 && childFacilityCount === 0;
}

export function facilityHasValidParentChain(parentIds: string[], currentFacilityId: string): boolean {
  const visited = new Set<string>();
  for (const parentId of parentIds) {
    if (parentId === currentFacilityId || visited.has(parentId)) return false;
    visited.add(parentId);
  }
  return true;
}
