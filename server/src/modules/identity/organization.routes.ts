import { Router } from "express";
import { z } from "zod";
import type { CookieOptions } from "express";
import { env } from "../../config/env.js";
import { AuthError, issueSession, revokeRefreshToken } from "./auth.service.js";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "./auth.middleware.js";
import { Organization } from "./organization.model.js";
import { Membership } from "./membership.model.js";
import { AuditEvent } from "./audit-event.model.js";
import { OrganizationInvitation } from "./invitation.model.js";
import { User } from "./user.model.js";
import { createHash, randomBytes } from "node:crypto";
import { roles, type Role } from "./identity.types.js";
import { canAssignRole, canInviteRole, canManageOwner } from "./organization.policy.js";

export const organizationRouter = Router();
organizationRouter.use(requireAuth);

const refreshCookieOptions: CookieOptions = {
  httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax",
  path: "/", maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
};
const roleSchema = z.enum(roles);
const inviteRoleSchema = z.enum(["admin", "operator", "analyst", "viewer"]);
const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");
const readRefreshCookie = (req: AuthenticatedRequest) => {
  const raw = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("voltwise_refresh="));
  return raw ? decodeURIComponent(raw.slice("voltwise_refresh=".length)) : undefined;
};
const writeAudit = (tenantId: string, actorUserId: string, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) =>
  AuditEvent.create({ tenantId, actorUserId, action, resourceType, resourceId, metadata });

organizationRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const memberships = await Membership.find({ userId: req.auth!.userId, status: "active" })
      .populate({ path: "tenantId", select: "name slug" }).sort({ createdAt: 1 }).lean();
    res.json({ data: memberships.map((membership) => {
      const organization = membership.tenantId as unknown as { _id: { toString(): string }; name: string; slug: string };
      return { id: organization._id.toString(), name: organization.name, slug: organization.slug,
        role: membership.role, active: organization._id.toString() === req.auth!.tenantId };
    }) });
  } catch (error) { next(error); }
});

organizationRouter.post("/:organizationId/switch", async (req: AuthenticatedRequest, res, next) => {
  try {
    const organizationId = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.organizationId);
    const membership = await Membership.findOne({ tenantId: organizationId, userId: req.auth!.userId, status: "active" });
    if (!membership) throw new AuthError("ORGANIZATION_ACCESS_DENIED", "You are not an active member of this organization.", 403);
    const currentRefreshToken = readRefreshCookie(req);
    const session = await issueSession(req.auth!.userId, organizationId, membership.role as Role);
    if (currentRefreshToken) await revokeRefreshToken(currentRefreshToken);
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
    res.json({ data: members.map((member) => {
      const user = member.userId as unknown as { _id: { toString(): string }; name: string; email: string } | null;
      return { id: member._id.toString(), role: member.role, status: member.status, joinedAt: member.createdAt,
        user: user && user.email ? { id: user._id.toString(), name: user.name, email: user.email } : null };
    }) });
  } catch (error) { next(error); }
});

organizationRouter.patch("/members/:membershipId/role", requirePermission("members:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const membershipId = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.membershipId);
    const role = roleSchema.parse(req.body.role);
    const target = await Membership.findOne({ _id: membershipId, tenantId: req.auth!.tenantId, status: "active" });
    if (!target) throw new AuthError("MEMBER_NOT_FOUND", "Active organization member was not found.", 404);
    if (target.userId.toString() === req.auth!.userId) throw new AuthError("SELF_ROLE_CHANGE_DENIED", "You cannot change your own organization role.", 403);
    if (!canAssignRole(req.auth!.role, role)) throw new AuthError("ROLE_ESCALATION_DENIED", "Your role cannot assign the requested organization role.", 403);
    if (target.role === "owner" && role !== "owner") {
      const owners = await Membership.countDocuments({ tenantId: req.auth!.tenantId, role: "owner", status: "active" });
      if (owners <= 1) throw new AuthError("LAST_OWNER_REQUIRED", "An organization must retain at least one active owner.", 409);
      if (!canManageOwner(req.auth!.role, owners)) throw new AuthError("OWNER_MANAGEMENT_DENIED", "Only an owner can change another owner's role.", 403);
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
    const membershipId = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.membershipId);
    const status = z.enum(["active", "suspended"]).parse(req.body.status);
    const target = await Membership.findOne({ _id: membershipId, tenantId: req.auth!.tenantId, status: { $in: ["active", "suspended"] } });
    if (!target) throw new AuthError("MEMBER_NOT_FOUND", "Organization member was not found.", 404);
    if (target.userId.toString() === req.auth!.userId) throw new AuthError("SELF_MEMBERSHIP_CHANGE_DENIED", "You cannot change your own membership status.", 403);
    if (target.role === "owner" && status === "suspended") {
      const owners = await Membership.countDocuments({ tenantId: req.auth!.tenantId, role: "owner", status: "active" });
      if (owners <= 1) throw new AuthError("LAST_OWNER_REQUIRED", "An organization must retain at least one active owner.", 409);
      if (!canManageOwner(req.auth!.role, owners)) throw new AuthError("OWNER_MANAGEMENT_DENIED", "Only an owner can suspend another owner.", 403);
    }
    target.status = status;
    await target.save();
    await writeAudit(req.auth!.tenantId, req.auth!.userId, status === "suspended" ? "member.suspended" : "member.reactivated", "membership", membershipId);
    res.json({ data: { id: target.id, role: target.role, status: target.status } });
  } catch (error) { next(error); }
});


organizationRouter.post("/invitations", requirePermission("members:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = z.object({ email: z.string().trim().email().max(254), role: inviteRoleSchema }).parse(req.body);
    if (!canInviteRole(req.auth!.role, input.role)) {
      throw new AuthError("ROLE_ESCALATION_DENIED", "Your role cannot invite a member with the requested role.", 403);
    }
    const email = input.email.toLowerCase();
    const targetUser = await User.findOne({ email }).select("_id");
    if (targetUser) {
      const existingMembership = await Membership.findOne({ tenantId: req.auth!.tenantId, userId: targetUser._id });
      if (existingMembership?.status === "active") throw new AuthError("ALREADY_A_MEMBER", "This user is already an active organization member.", 409);
      if (existingMembership?.role === "owner") throw new AuthError("OWNER_INVITATION_DENIED", "An owner membership cannot be replaced by an invitation.", 409);
    }
    const pending = await OrganizationInvitation.findOne({
      tenantId: req.auth!.tenantId, email, status: "pending", expiresAt: { $gt: new Date() }
    });
    if (pending) throw new AuthError("INVITATION_ALREADY_PENDING", "A pending invitation already exists for this email.", 409);
    const token = randomBytes(32).toString("base64url");
    const invitation = await OrganizationInvitation.create({
      tenantId: req.auth!.tenantId, email, role: input.role, tokenHash: hashInvitationToken(token),
      invitedBy: req.auth!.userId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await writeAudit(req.auth!.tenantId, req.auth!.userId, "invitation.created", "invitation", invitation.id, { email, role: input.role });
    // The opaque token is returned once so a configured delivery adapter can send it; it is never persisted or logged in plaintext.
    res.status(201).json({ data: {
      id: invitation.id, email, role: invitation.role, status: invitation.status,
      expiresAt: invitation.expiresAt, invitationToken: token
    } });
  } catch (error) { next(error); }
});

organizationRouter.get("/invitations", requirePermission("members:read"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const invitations = await OrganizationInvitation.find({ tenantId: req.auth!.tenantId, status: "pending", expiresAt: { $gt: new Date() } })
      .select("-tokenHash").sort({ createdAt: -1 }).lean();
    res.json({ data: invitations });
  } catch (error) { next(error); }
});

organizationRouter.post("/invitations/accept", async (req: AuthenticatedRequest, res, next) => {
  try {
    const token = z.string().min(32).max(128).parse(req.body.token);
    const user = await User.findById(req.auth!.userId).select("email");
    if (!user) throw new AuthError("USER_NOT_FOUND", "Account no longer exists.", 404);
    const invitation = await OrganizationInvitation.findOne({
      tokenHash: hashInvitationToken(token), status: "pending", expiresAt: { $gt: new Date() }
    }).select("+tokenHash");
    if (!invitation) throw new AuthError("INVITATION_INVALID", "Invitation is invalid, expired, or no longer pending.", 404);
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AuthError("INVITATION_EMAIL_MISMATCH", "Sign in with the email address this invitation was sent to.", 403);
    }
    const claimed = await OrganizationInvitation.findOneAndUpdate(
      { _id: invitation._id, status: "pending", expiresAt: { $gt: new Date() } },
      { $set: { status: "accepted", acceptedBy: user._id, acceptedAt: new Date() } },
      { new: true }
    );
    if (!claimed) throw new AuthError("INVITATION_ALREADY_USED", "This invitation has already been accepted or revoked.", 409);
    try {
      const membership = await Membership.findOneAndUpdate(
        { tenantId: claimed.tenantId, userId: user._id },
        { $set: { role: claimed.role, status: "active" }, $setOnInsert: { tenantId: claimed.tenantId, userId: user._id } },
        { new: true, upsert: true, runValidators: true }
      );
      await writeAudit(claimed.tenantId.toString(), user.id, "invitation.accepted", "invitation", claimed.id, { role: claimed.role });
      res.status(200).json({ data: { organizationId: claimed.tenantId.toString(), membershipId: membership!.id, role: membership!.role } });
    } catch (error) {
      await OrganizationInvitation.updateOne({ _id: claimed._id, status: "accepted", acceptedBy: user._id }, { $set: { status: "pending", acceptedBy: null, acceptedAt: null } });
      throw error;
    }
  } catch (error) { next(error); }
});

organizationRouter.delete("/invitations/:invitationId", requirePermission("members:manage"), async (req: AuthenticatedRequest, res, next) => {
  try {
    const invitationId = z.string().regex(/^[a-f\\d]{24}$/i).parse(req.params.invitationId);
    const invitation = await OrganizationInvitation.findOneAndUpdate(
      { _id: invitationId, tenantId: req.auth!.tenantId, status: "pending" },
      { $set: { status: "revoked" } }, { new: true }
    );
    if (!invitation) throw new AuthError("INVITATION_NOT_FOUND", "Pending organization invitation was not found.", 404);
    await writeAudit(req.auth!.tenantId, req.auth!.userId, "invitation.revoked", "invitation", invitation.id);
    res.status(204).send();
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
