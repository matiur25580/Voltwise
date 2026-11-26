import { Router } from "express";
import { z } from "zod";
import { AuthError } from "../identity/auth.service.js";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../identity/auth.middleware.js";
import { AuditEvent } from "../identity/audit-event.model.js";
import { Facility } from "../assets/facility.model.js";
import { EnergyAsset } from "../assets/energy-asset.model.js";
import { TelemetryDevice } from "./device.model.js";
import { TelemetryEvent } from "./telemetry-event.model.js";
import { createDeviceCredential, ingestTelemetry, telemetryEvents } from "./telemetry.service.js";

export const telemetryRouter = Router();
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const provisionSchema = z.object({
  facilityId: idSchema, assetId: idSchema,
  deviceCode: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().trim().min(2).max(120)
});
const audit = (req: AuthenticatedRequest, action: string, resourceId: string, metadata: Record<string, unknown> = {}) =>
  AuditEvent.create({ tenantId: req.auth!.tenantId, actorUserId: req.auth!.userId, action, resourceType: "telemetry_device", resourceId, metadata });

telemetryRouter.post("/devices", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = provisionSchema.parse(req.body);
    const [facility, asset] = await Promise.all([
      Facility.findOne({ _id: input.facilityId, tenantId: req.auth!.tenantId }).select("_id"),
      EnergyAsset.findOne({ _id: input.assetId, tenantId: req.auth!.tenantId, facilityId: input.facilityId, status: { $ne: "decommissioned" } }).select("_id")
    ]);
    if (!facility || !asset) throw new AuthError("DEVICE_ASSET_SCOPE_INVALID", "The selected facility and asset must belong to this organization and match each other.", 404);
    const { credential, credentialHash } = createDeviceCredential();
    const device = await TelemetryDevice.create({
      ...input, tenantId: req.auth!.tenantId, credentialHash, createdBy: req.auth!.userId
    });
    await audit(req, "telemetry_device.provisioned", device.id, { deviceCode: device.deviceCode, assetId: device.assetId.toString() });
    const { credentialHash: _credentialHash, ...safeDevice } = device.toObject();\n    res.status(201).json({ data: safeDevice, deviceCredential: credential, warning: "Copy this credential now. It is shown only once." });
  } catch (error) { next(error); }
});

telemetryRouter.get("/devices", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const devices = await TelemetryDevice.find({ tenantId: req.auth!.tenantId })
      .populate({ path: "facilityId", select: "name code" }).populate({ path: "assetId", select: "name assetTag type" })
      .sort({ createdAt: -1 }).limit(200).lean();
    res.json({ data: devices });
  } catch (error) { next(error); }
});

telemetryRouter.post("/devices/:deviceId/revoke", requireAuth, requirePermission("assets:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const deviceId = idSchema.parse(req.params.deviceId);
    const device = await TelemetryDevice.findOne({ _id: deviceId, tenantId: req.auth!.tenantId });
    if (!device) throw new AuthError("DEVICE_NOT_FOUND", "Device was not found in this organization.", 404);
    device.status = "revoked"; device.revokedAt = new Date(); device.credentialHash = "revoked";
    await device.save();
    await audit(req, "telemetry_device.revoked", device.id, { deviceCode: device.deviceCode });
    res.status(200).json({ data: { id: device.id, status: device.status, revokedAt: device.revokedAt } });
  } catch (error) { next(error); }
});

telemetryRouter.post("/telemetry/ingest", async (req, res, next) => {
  try {
    const deviceCode = z.string().trim().min(3).max(64).parse(req.header("x-device-code"));
    const credential = req.header("x-device-key") ?? "";
    const result = await ingestTelemetry(deviceCode, credential, req.body);
    res.status(202).json({ data: result });
  } catch (error) { next(error); }
});

telemetryRouter.get("/telemetry/readings", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      assetId: idSchema.optional(), deviceId: idSchema.optional(),
      from: z.coerce.date().optional(), to: z.coerce.date().optional()
    }).parse(req.query);
    if (filters.from && filters.to && filters.from > filters.to) throw new AuthError("INVALID_TIME_RANGE", "The from timestamp must be before the to timestamp.", 400);
    const query: Record<string, unknown> = { tenantId: req.auth!.tenantId };
    if (filters.assetId) query.assetId = filters.assetId;
    if (filters.deviceId) query.deviceId = filters.deviceId;
    if (filters.from || filters.to) query.occurredAt = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) };
    const [data, total] = await Promise.all([
      TelemetryEvent.find(query).sort({ occurredAt: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit)
        .populate({ path: "assetId", select: "name assetTag type" }).populate({ path: "deviceId", select: "deviceCode name" }).lean(),
      TelemetryEvent.countDocuments(query)
    ]);
    res.json({ data, pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) } });
  } catch (error) { next(error); }
});

telemetryRouter.get("/telemetry/stream", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.auth!.tenantId;
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`event: ready\\ndata: ${JSON.stringify({ connected: true })}\\n\\n`);
  const listener = (message: { tenantId: string; event: unknown }) => {
    if (message.tenantId === tenantId) res.write(`event: reading\\ndata: ${JSON.stringify(message.event)}\\n\\n`);
  };
  telemetryEvents.on("reading", listener);
  const heartbeat = setInterval(() => res.write(": heartbeat\\n\\n"), 25_000);
  res.on("close", () => { clearInterval(heartbeat); telemetryEvents.off("reading", listener); });
});
