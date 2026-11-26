import { Router } from "express";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "./auth.middleware.js";
import { Organization } from "./organization.model.js";
import { Membership } from "./membership.model.js";

export const organizationRouter = Router();
organizationRouter.use(requireAuth);

organizationRouter.get("/current", requirePermission("organization:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const organization = await Organization.findById(req.auth!.tenantId).select("name slug createdAt");
    if (!organization) { res.status(404).json({ error: { code: "TENANT_NOT_FOUND", message: "Organization not found." } }); return; }
    const memberCount = await Membership.countDocuments({ tenantId: req.auth!.tenantId, status: "active" });
    res.json({ data: { organization, memberCount, role: req.auth!.role } });
  } catch (error) { next(error); }
});
