import { Router } from "express";
import { z } from "zod";
import { AuthError } from "../identity/auth.service.js";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../identity/auth.middleware.js";
import { getEnergyAnalytics } from "./analytics.service.js";

export const analyticsRouter = Router();
const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  granularity: z.enum(["hour", "day"]).default("day"),
  assetId: z.string().regex(/^[a-f\\d]{24}$/i).optional(),
  tariffRate: z.coerce.number().min(0).max(1000).optional()
});

analyticsRouter.get("/analytics/energy", requireAuth, requirePermission("energy:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const filters = querySchema.parse(req.query);
    const to = filters.to ?? new Date();
    const from = filters.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60_000);
    if (from >= to) throw new AuthError("INVALID_TIME_RANGE", "The from timestamp must be before the to timestamp.", 400);
    if (to.getTime() - from.getTime() > 90 * 24 * 60 * 60_000) {
      throw new AuthError("TIME_RANGE_TOO_LARGE", "Energy analytics supports a maximum 90-day window.", 400);
    }
    const data = await getEnergyAnalytics({
      tenantId: req.auth!.tenantId, from, to, granularity: filters.granularity,
      ...(filters.assetId ? { assetId: filters.assetId } : {}),
      ...(filters.tariffRate === undefined ? {} : { tariffRate: filters.tariffRate })
    });
    res.json({ data, range: { from: from.toISOString(), to: to.toISOString() } });
  } catch (error) { next(error); }
});
