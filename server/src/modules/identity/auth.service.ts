import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { Membership } from "./membership.model.js";
import { Organization } from "./organization.model.js";
import { RefreshSession } from "./refresh-session.model.js";
import { User } from "./user.model.js";
import type { Role } from "./identity.types.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const refreshExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

export class AuthError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 401) { super(message); }
}

export async function issueSession(userId: string, tenantId: string, role: Role, familyId: string = randomUUID()) {
  const accessToken = jwt.sign({ tenantId, role }, env.JWT_ACCESS_SECRET as jwt.Secret, {
    subject: userId, expiresIn: env.ACCESS_TOKEN_TTL as NonNullable<jwt.SignOptions["expiresIn"]>, issuer: "voltwise-api", audience: "voltwise-client"
  });
  const refreshToken = randomBytes(48).toString("base64url");
  const tokenHash = hashToken(refreshToken);
  await RefreshSession.create({
    userId, tenantId, tokenHash, familyId, expiresAt: refreshExpiry(), revokedAt: null
  });
  return { accessToken, refreshToken };
}

export async function register(input: { name: string; email: string; password: string; organizationName: string }) {
  const email = input.email.toLowerCase().trim();
  if (await User.exists({ email })) throw new AuthError("EMAIL_IN_USE", "An account with this email already exists.", 409);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name.trim(), email, passwordHash });
  const baseSlug = slugify(input.organizationName) || "organization";
  const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
  const organization = await Organization.create({ name: input.organizationName.trim(), slug, createdBy: user._id });
  await Membership.create({ tenantId: organization._id, userId: user._id, role: "owner", status: "active" });
  return { user, organization, session: await issueSession(user.id, organization.id, "owner") };
}

export async function login(emailInput: string, password: string) {
  const user = await User.findOne({ email: emailInput.toLowerCase().trim() }).select("+passwordHash");
  if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AuthError("INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  const membership = await Membership.findOne({ userId: user._id, status: "active" }).sort({ createdAt: 1 });
  if (!membership) throw new AuthError("NO_ACTIVE_MEMBERSHIP", "This account has no active organization.", 403);
  return { user, membership, session: await issueSession(user.id, membership.tenantId.toString(), membership.role as Role) };
}

export async function rotateRefreshToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshSession.findOne({ tokenHash }).select("+tokenHash");
  if (!existing) throw new AuthError("INVALID_REFRESH_TOKEN", "Refresh token is invalid.");
  if (existing.revokedAt || existing.expiresAt <= new Date()) {
    if (existing.revokedAt) await RefreshSession.updateMany({ familyId: existing.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw new AuthError("REFRESH_TOKEN_REUSE", "Refresh token reuse detected. Please sign in again.");
  }
  const revoked = await RefreshSession.findOneAndUpdate(
    { _id: existing._id, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } }, { new: true }
  );
  if (!revoked) {
    await RefreshSession.updateMany({ familyId: existing.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw new AuthError("REFRESH_TOKEN_REUSE", "Refresh token has already been rotated.");
  }
  const membership = await Membership.findOne({ tenantId: existing.tenantId, userId: existing.userId, status: "active" });
  if (!membership) {
    await RefreshSession.updateMany({ familyId: existing.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw new AuthError("MEMBERSHIP_REVOKED", "Organization membership is no longer active.", 403);
  }
  const session = await issueSession(existing.userId.toString(), existing.tenantId.toString(), membership.role as Role, existing.familyId);
  await RefreshSession.updateOne({ _id: revoked._id }, { $set: { replacedByHash: hashToken(session.refreshToken) } });
  return session;
}

export async function revokeRefreshToken(rawToken: string) {
  await RefreshSession.updateOne({ tokenHash: hashToken(rawToken), revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "voltwise-api", audience: "voltwise-client" }) as jwt.JwtPayload & {
    sub: string; tenantId: string; role: Role;
  };
}
