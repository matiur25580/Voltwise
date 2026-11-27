import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { AuthError } from "../identity/auth.service.js";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../identity/auth.middleware.js";
import { AuditEvent } from "../identity/audit-event.model.js";
import { EnergyAsset } from "../assets/energy-asset.model.js";
import { FlexibilityPlan } from "./flexibility-plan.model.js";
import { simulateBatteryDispatch } from "./flexibility.service.js";
export const flexibilityRouter = Router();
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
const simulationSchema = z.object({
  name: z.string().trim().min(3).max(120), facilityId: idSchema.optional(),
  batteryAssetIds: z.array(idSchema).min(1).max(20),
  baselineLoadKw: z.array(z.number().finite().min(0).max(100000)).min(1).max(96),
  intervalMinutes: z.number().int().refine((value) => [15, 30, 60].includes(value)).default(60),
  targetDemandKw: z.number().finite().positive().max(100000),
  initialSocPercent: z.number().min(0).max(100).default(80),
  reserveSocPercent: z.number().min(0).max(95).default(20),
  maxDischargeKw: z.number().finite().positive().max(100000),
  tariffRatesPerKwh: z.array(z.number().finite().min(0).max(1000)).max(96).optional()
}).superRefine((value, ctx) => {
  if (value.reserveSocPercent >= value.initialSocPercent) ctx.addIssue({ code: "custom", path: ["reserveSocPercent"], message: "Reserve state of charge must be below initial state of charge." });
  if (value.tariffRatesPerKwh && value.tariffRatesPerKwh.length !== value.baselineLoadKw.length) ctx.addIssue({ code: "custom", path: ["tariffRatesPerKwh"], message: "Tariff count must match the load-profile interval count." });
});
const decisionSchema = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(1000).default("") });
flexibilityRouter.post("/flexibility/simulations", requireAuth, requirePermission("energy:write"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = simulationSchema.parse(req.body), tenantId = req.auth!.tenantId;
    const batteryIds = [...new Set(input.batteryAssetIds)];
    const query: Record<string, unknown> = { _id: { $in: batteryIds }, tenantId, type: "battery", status: "active" };
    if (input.facilityId) query.facilityId = input.facilityId;
    const batteries = await EnergyAsset.find(query).select("_id facilityId capacity").lean();
    if (batteries.length !== batteryIds.length) throw new AuthError("BATTERY_SCOPE_INVALID", "Every selected battery must be active, registered to this organization, and belong to the selected facility.", 404);
    const facilityIds = [...new Set(batteries.map((item) => item.facilityId.toString()))];
    if (facilityIds.length !== 1) throw new AuthError("BATTERY_FACILITY_MISMATCH", "A simulation can combine batteries from one facility only.", 400);
    const facilityId = facilityIds[0]!;
    if (input.facilityId && facilityId !== input.facilityId) throw new AuthError("BATTERY_FACILITY_MISMATCH", "Selected batteries do not belong to the selected facility.", 400);
    const batteryCapacityKwh = batteries.reduce((sum, battery) => {
      const value = battery.capacity?.value ?? 0, unit = battery.capacity?.unit?.toLowerCase();
      return sum + (unit === "mwh" ? value * 1000 : unit === "kwh" ? value : 0);
    }, 0);
    if (batteryCapacityKwh <= 0) throw new AuthError("BATTERY_CAPACITY_MISSING", "Selected battery assets need a positive capacity recorded in kWh or MWh.", 400);
    const dispatch = simulateBatteryDispatch({ ...input, batteryCapacityKwh });
    const plan = await FlexibilityPlan.create({
      tenantId, facilityId: new Types.ObjectId(facilityId), batteryAssetIds: batteries.map((item) => item._id),
      ...input, batteryCapacityKwh, ...dispatch, createdBy: req.auth!.userId, status: "proposed"
    });
    await AuditEvent.create({ tenantId, actorUserId: req.auth!.userId, action: "flexibility.simulation.created", resourceType: "flexibility_plan", resourceId: plan.id, metadata: { batteryAssetIds: batteryIds, avoidedEnergyKwh: dispatch.summary.avoidedEnergyKwh } });
    res.status(201).json({ data: plan });
  } catch (error) { next(error); }
});
flexibilityRouter.get("/flexibility/simulations", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const plans = await FlexibilityPlan.find({ tenantId: req.auth!.tenantId }).sort({ createdAt: -1 }).limit(100)
      .populate({ path: "facilityId", select: "name code" }).populate({ path: "batteryAssetIds", select: "name assetTag capacity" }).lean();
    res.json({ data: plans });
  } catch (error) { next(error); }
});
flexibilityRouter.post("/flexibility/simulations/:planId/decision", requireAuth, requirePermission("energy:write"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const planId = idSchema.parse(req.params.planId), input = decisionSchema.parse(req.body);
    const plan = await FlexibilityPlan.findOneAndUpdate(
      { _id: planId, tenantId: req.auth!.tenantId, status: "proposed" },
      { $set: {
        status: input.decision === "approve" ? "approved" : "rejected",
        decisionNote: input.note, decidedBy: new Types.ObjectId(req.auth!.userId), decidedAt: new Date()
      } },
      { new: true, runValidators: true }
    );
    if (!plan) {
      const exists = await FlexibilityPlan.exists({ _id: planId, tenantId: req.auth!.tenantId });
      if (!exists) throw new AuthError("FLEXIBILITY_PLAN_NOT_FOUND", "Simulation was not found in this organization.", 404);
      throw new AuthError("FLEXIBILITY_PLAN_ALREADY_DECIDED", "Only proposed simulations can be approved or rejected.", 409);
    }
    await AuditEvent.create({ tenantId: req.auth!.tenantId, actorUserId: req.auth!.userId, action: "flexibility.simulation." + input.decision, resourceType: "flexibility_plan", resourceId: plan.id, metadata: { note: input.note, avoidedEnergyKwh: plan.summary.avoidedEnergyKwh } });
    res.json({ data: plan });
  } catch (error) { next(error); }
});
