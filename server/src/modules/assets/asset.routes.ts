import { Router } from "express";
import { z } from "zod";
import { AuthError } from "../identity/auth.service.js";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../identity/auth.middleware.js";
import { AuditEvent } from "../identity/audit-event.model.js";
import { Facility, facilityStatuses, facilityTypes } from "./facility.model.js";
import { EnergyAsset, energyAssetStatuses, energyAssetTypes } from "./energy-asset.model.js";
import { canDeleteFacility, escapeSearchTerm } from "./asset.policy.js";

export const assetRouter = Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const addressSchema = z.object({
  line1: z.string().trim().max(160).optional(),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().max(100).optional(),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(24).optional(),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()).optional()
}).optional();
const facilityInput = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  name: z.string().trim().min(2).max(160),
  type: z.enum(facilityTypes),
  status: z.enum(facilityStatuses).optional(),
  parentFacilityId: objectId.nullable().optional(),
  address: addressSchema,
  timezone: z.string().trim().min(1).max(80).optional(),
  floorArea: z.object({ value: z.number().positive(), unit: z.enum(["m2", "ft2"]) }).optional(),
  notes: z.string().trim().max(2000).optional()
});
const facilityPatch = facilityInput.partial().refine((value) => Object.keys(value).length > 0, "At least one field is required.");
const assetInput = z.object({
  facilityId: objectId,
  assetTag: z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  name: z.string().trim().min(2).max(160),
  type: z.enum(energyAssetTypes),
  status: z.enum(energyAssetStatuses).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  manufacturer: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  capacity: z.object({ value: z.number().positive(), unit: z.string().trim().min(1).max(24) }).optional(),
  commissionedAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional()
});
const assetPatch = assetInput.omit({ facilityId: true }).partial().refine((value) => Object.keys(value).length > 0, "At least one field is required.");
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  facilityId: objectId.optional()
});
const audit = (req: AuthenticatedRequest, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) =>
  AuditEvent.create({ tenantId: req.auth!.tenantId, actorUserId: req.auth!.userId, action, resourceType, resourceId, metadata });

async function assertParentInTenant(tenantId: string, parentId: string | null | undefined, currentId?: string) {
  if (!parentId) return;
  if (parentId === currentId) throw new AuthError("FACILITY_HIERARCHY_INVALID", "A facility cannot be its own parent.", 400);
  const visited = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === currentId) throw new AuthError("FACILITY_HIERARCHY_CYCLE", "This parent would create a facility hierarchy cycle.", 409);
    if (visited.has(cursor)) throw new AuthError("FACILITY_HIERARCHY_CORRUPT", "The existing facility hierarchy contains a cycle.", 409);
    visited.add(cursor);
    const parent: { parentFacilityId?: { toString(): string } | null } | null = await Facility.findOne({ _id: cursor, tenantId }).select("parentFacilityId").lean();
    if (!parent) throw new AuthError("PARENT_FACILITY_NOT_FOUND", "Parent facility does not exist in this organization.", 404);
    cursor = parent.parentFacilityId?.toString() ?? null;
  }
}

assetRouter.post("/facilities", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = facilityInput.parse(req.body);
    await assertParentInTenant(req.auth!.tenantId, input.parentFacilityId);
    const facility = await Facility.create({ ...input, tenantId: req.auth!.tenantId, createdBy: req.auth!.userId });
    await audit(req, "facility.created", "facility", facility.id, { code: facility.code, type: facility.type });
    res.status(201).json({ data: facility });
  } catch (error) { next(error); }
});

assetRouter.get("/facilities", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = pagination.parse(req.query);
    const query: Record<string, unknown> = { tenantId: req.auth!.tenantId };
    if (filters.status) query.status = z.enum(facilityStatuses).parse(filters.status);
    if (filters.type) query.type = z.enum(facilityTypes).parse(filters.type);
    if (filters.q) query.$or = [
      { name: { $regex: escapeSearchTerm(filters.q), $options: "i" } },
      { code: { $regex: escapeSearchTerm(filters.q), $options: "i" } }
    ];
    const [items, total] = await Promise.all([
      Facility.find(query).sort({ name: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
      Facility.countDocuments(query)
    ]);
    res.json({ data: items, pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) } });
  } catch (error) { next(error); }
});

assetRouter.get("/facilities/:facilityId", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const facilityId = objectId.parse(req.params.facilityId);
    const facility = await Facility.findOne({ _id: facilityId, tenantId: req.auth!.tenantId }).lean();
    if (!facility) throw new AuthError("FACILITY_NOT_FOUND", "Facility was not found in this organization.", 404);
    const [assetCount, childCount] = await Promise.all([
      EnergyAsset.countDocuments({ tenantId: req.auth!.tenantId, facilityId }),
      Facility.countDocuments({ tenantId: req.auth!.tenantId, parentFacilityId: facilityId })
    ]);
    res.json({ data: { ...facility, assetCount, childCount } });
  } catch (error) { next(error); }
});

assetRouter.patch("/facilities/:facilityId", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const facilityId = objectId.parse(req.params.facilityId);
    const input = facilityPatch.parse(req.body);
    const facility = await Facility.findOne({ _id: facilityId, tenantId: req.auth!.tenantId });
    if (!facility) throw new AuthError("FACILITY_NOT_FOUND", "Facility was not found in this organization.", 404);
    if (input.parentFacilityId !== undefined) await assertParentInTenant(req.auth!.tenantId, input.parentFacilityId, facilityId);
    Object.assign(facility, input);
    await facility.save();
    await audit(req, "facility.updated", "facility", facility.id, { fields: Object.keys(input) });
    res.json({ data: facility });
  } catch (error) { next(error); }
});

assetRouter.delete("/facilities/:facilityId", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const facilityId = objectId.parse(req.params.facilityId);
    const [facility, assetCount, childCount] = await Promise.all([
      Facility.findOne({ _id: facilityId, tenantId: req.auth!.tenantId }),
      EnergyAsset.countDocuments({ tenantId: req.auth!.tenantId, facilityId }),
      Facility.countDocuments({ tenantId: req.auth!.tenantId, parentFacilityId: facilityId })
    ]);
    if (!facility) throw new AuthError("FACILITY_NOT_FOUND", "Facility was not found in this organization.", 404);
    if (!canDeleteFacility(assetCount, childCount)) throw new AuthError("FACILITY_NOT_EMPTY", "Move or decommission its assets and child facilities before deleting it.", 409);
    await facility.deleteOne();
    await audit(req, "facility.deleted", "facility", facilityId);
    res.status(204).send();
  } catch (error) { next(error); }
});

assetRouter.post("/assets", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = assetInput.parse(req.body);
    const facility = await Facility.findOne({ _id: input.facilityId, tenantId: req.auth!.tenantId }).select("_id");
    if (!facility) throw new AuthError("FACILITY_NOT_FOUND", "The selected facility does not exist in this organization.", 404);
    const asset = await EnergyAsset.create({ ...input, tenantId: req.auth!.tenantId, createdBy: req.auth!.userId });
    await audit(req, "energy_asset.created", "energy_asset", asset.id, { assetTag: asset.assetTag, type: asset.type, facilityId: asset.facilityId.toString() });
    res.status(201).json({ data: asset });
  } catch (error) { next(error); }
});

assetRouter.get("/assets", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = pagination.parse(req.query);
    const query: Record<string, unknown> = { tenantId: req.auth!.tenantId };
    if (filters.facilityId) query.facilityId = filters.facilityId;
    if (filters.status) query.status = z.enum(energyAssetStatuses).parse(filters.status);
    if (filters.type) query.type = z.enum(energyAssetTypes).parse(filters.type);
    if (filters.q) query.$or = [
      { name: { $regex: escapeSearchTerm(filters.q), $options: "i" } },
      { assetTag: { $regex: escapeSearchTerm(filters.q), $options: "i" } },
      { serialNumber: { $regex: escapeSearchTerm(filters.q), $options: "i" } }
    ];
    const [items, total] = await Promise.all([
      EnergyAsset.find(query).populate({ path: "facilityId", select: "name code type" })
        .sort({ name: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
      EnergyAsset.countDocuments(query)
    ]);
    res.json({ data: items, pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) } });
  } catch (error) { next(error); }
});

assetRouter.get("/assets/:assetId", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const assetId = objectId.parse(req.params.assetId);
    const asset = await EnergyAsset.findOne({ _id: assetId, tenantId: req.auth!.tenantId })
      .populate({ path: "facilityId", select: "name code type" }).lean();
    if (!asset) throw new AuthError("ASSET_NOT_FOUND", "Energy asset was not found in this organization.", 404);
    res.json({ data: asset });
  } catch (error) { next(error); }
});

assetRouter.patch("/assets/:assetId", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const assetId = objectId.parse(req.params.assetId);
    const input = assetPatch.parse(req.body);
    const asset = await EnergyAsset.findOne({ _id: assetId, tenantId: req.auth!.tenantId });
    if (!asset) throw new AuthError("ASSET_NOT_FOUND", "Energy asset was not found in this organization.", 404);
    Object.assign(asset, input);
    await asset.save();
    await audit(req, "energy_asset.updated", "energy_asset", asset.id, { fields: Object.keys(input) });
    res.json({ data: asset });
  } catch (error) { next(error); }
});

assetRouter.delete("/assets/:assetId", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const assetId = objectId.parse(req.params.assetId);
    const asset = await EnergyAsset.findOne({ _id: assetId, tenantId: req.auth!.tenantId });
    if (!asset) throw new AuthError("ASSET_NOT_FOUND", "Energy asset was not found in this organization.", 404);
    asset.status = "decommissioned";
    await asset.save();
    await audit(req, "energy_asset.decommissioned", "energy_asset", asset.id, { assetTag: asset.assetTag });
    res.status(204).send();
  } catch (error) { next(error); }
});
