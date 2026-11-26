import { Router } from "express";
import { z } from "zod";
import type { CookieOptions } from "express";
import { env } from "../../config/env.js";
import { AuthError, issueSession } from "./auth.service.js";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "./auth.middleware.js";
import { Organization } from "./organization.model.js";
import { Membership } from "./membership.model.js";
import { User } from "./user.model.js";
import { AuditEvent } from "./audit-event.model.js";
import { roles, type Role } from "./identity.types.js";

export const organizationRouter = Router();
organizationRouter.use(requireAuth);

const refreshCookieOptions: CookieOptions = {
  httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax",
  path: "/api/v1/auth", maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
};
const roleSchema = z.enum(roles);
const writeAudit = (tenantId: string, actorUserId: string, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) =>
  AuditEvent.create({ tenantId, actorUserId, action, resourceType, resourceId, metadata });

organizationRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const memberships = await Membership.find({ userId: req.auth!.userId, status: "active" })
      .populate({ path: "tenantId", select: "name slug" }).sort({ createdAt: 1 }).lean();
    res.json({ data: memberships.map((membership) => ({
      id: (membership.tenantId as unknown as { _id: { toString(): string }; name: string; slug: string })._id.toString(),
      name: (membership.tenantId as unknown as { name: string }).name,
      slug: (membership.tenantId as unknown as { slug: string }).slug,
      role: membership.role,
      active: membership.tenantId._id.toString() === req.auth!.tenantId
    })) });
  } catch (error) { next(error); }
});

organizationRouter.post("/:organizationId/switch", async (req: AuthenticatedRequest, res, next) => {
  try {
    const organizationId = z.string().regex(/^[a-f\\d]{24}$/i).parse(req.params.organizationId);
    const membership = await Membership.findOne({ tenantId: organizationId, userId: req.auth!.userId, status: "active" });
    if (!membership) throw new AuthError("ORGANIZATION_ACCESS_DENIED", "You are not an active member of this organization.", 403);
    const session = await issueSession(req.auth!.userId, organizationId, membership.role as Role);
    res.cookie("voltwise_refresh", session.refreshToken, refreshCookieOptions);
    await writeAudit(organizationId, req.auth!.userId, "organization.switched", "organization", organizationId);
    res.json({ data: { accessToken: session.accessToken, organizationId, role: membership.role } });
  } catch (error) { next(error); }
});

organizationRouter.get("/current", requirePermission("organization:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const organization = await Organization.findById(req.auth!.tenantId).select("name slug createdAt");
    if (!organization) { res.status(404).json({ error: { code: "TENANT_NOT_FOUND", message: "Organization not found." } }); return; }
    const memberCount = await Membership.countDocuments({ tenantId: req.auth!.tenantId, status: "active" });
    res.json({ data: { organization, memberCount, role: req.auth!.role } });
  } catch (error) { next(error); }
});

organizationRouter.get("/members", requirePermission("members:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const members = await Membership.find({ tenantId: req.auth!.tenantId })
      .populate({ path: "userId", select: "name email status" }).sort({ createdAt: 1 }).lean();
    res.json({ data: members.map((member) => ({
      id: member._id.toString(), role: member.role, status: member.status, joinedAt: member.createdAt,
      user: member.userId && typeof member.userId === "object" && "email" in member.userId
        ? { id: member.userId._id.toString(), name: member.userId.name, email: member.userId.email }
        : null
    })) });
  } catch (error) { next(error); }
});

organizationRouter.patch("/members/:membershipId/role", requirePermission("members:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const membershipId = z.string().regex(/^[a-f\\d]{24}$/i).parse(req.params.membershipId);
    const role = roleSchema.parse(req.body.role);
    const target = await Membership.findOne({ _id: membershipId, tenantId: req.auth!.tenantId, status: "active" });
    if (!target) throw new AuthError("MEMBER_NOT_FOUND", "Active organization member was not found.", 404);
    if (target.userId.toString() === req.auth!.userId) throw new AuthError("SELF_ROLE_CHANGE_DENIED", "You cannot change your own organization role.", 403);
    if (role === "owner" && req.auth!.role !== "owner") throw new AuthError("ROLE_ESCALATION_DENIED", "Only an owner can assign the owner role.", 403);
    if (req.auth!.role === "admin" && ["owner", "admin"].includes(role)) throw new AuthError("ROLE_ESCALATION_DENIED", "Administrators can assign operator, analyst, or viewer roles.", 403);
    if (target.role === "owner" && role !== "owner") {
      const owners = await Membership.countDocuments({ tenantId: req.auth!.tenantId, role: "owner", status: "active" });
      if (owners <= 1) throw new AuthError("LAST_OWNER_REQUIRED", "An organization must retain at least one active owner.", 409);
    }
    const previousRole = target.role;
    target.role = role;
    await target.save();
    await writeAudit(req.auth!.tenantId, req.auth!.userId, "member.role_changed", "membership", membershipId, { previousRole, newRole: role });
    res.json({ data: { id: target.id, role: target.role, status: target.status } });
  } catch (error) { next(error); }
});

organizationRouter.patch("/members/:membershipId/status", requirePermission("members:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const membershipId = z.string().regex(/^[a-f\\d]{24}$/i).parse(req.params.membershipId);
    const status = z.enum(["active", "suspended"]).parse(req.body.status);
    const target = await Membership.findOne({ _id: membershipId, tenantId: req.auth!.tenantId, status: { $in: ["active", "suspended"] } });
    if (!target) throw new AuthError("MEMBER_NOT_FOUND", "Organization member was not found.", 404);
    if (target.userId.toString() === req.auth!.userId) throw new AuthError("SELF_MEMBERSHIP_CHANGE_DENIED", "You cannot change your own membership status.", 403);
    if (target.role === "owner" && status === "suspended") {
      const owners = await Membership.countDocuments({ tenantId: req.auth!.tenantId, role: "owner", status: "active" });
      if (owners <= 1) throw new AuthError("LAST_OWNER_REQUIRED", "An organization must retain at least one active owner.", 409);
      if (req.auth!.role !== "owner") throw new AuthError("OWNER_MANAGEMENT_DENIED", "Only an owner can suspend another owner.", 403);
    }
    target.status = status;
    await target.save();
    await writeAudit(req.auth!.tenantId, req.auth!.userId, status === "suspended" ? "member.suspended" : "member.reactivated", "membership", membershipId);
    res.json({ data: { id: target.id, role: target.role, status: target.status } });
  } catch (error) { next(error); }
});

organizationRouter.get("/audit-events", requirePermission("members:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const events = await AuditEvent.find({ tenantId: req.auth!.tenantId }).sort({ occurredAt: -1 }).limit(limit)
      .populate({ path: "actorUserId", select: "name email" }).lean();
    res.json({ data: events });
  } catch (error) { next(error); }
});
