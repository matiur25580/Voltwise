import type { NextFunction, Request, Response } from "express";
import { AuthError, verifyAccessToken } from "./auth.service.js";
import { Membership } from "./membership.model.js";
import { rolePermissions, type Permission, type Role } from "./identity.types.js";

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; tenantId: string; role: Role; permissions: Permission[] };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new AuthError("UNAUTHENTICATED", "A valid access token is required.");
    let claims;
    try {
      claims = await verifyAccessToken(header.slice(7));
    } catch {
      throw new AuthError("INVALID_ACCESS_TOKEN", "Access token is invalid or expired.");
    }
    if (!claims.sub || !claims.tenantId) throw new AuthError("INVALID_TOKEN", "Access token claims are invalid.");
    const membership = await Membership.findOne({
      tenantId: claims.tenantId, userId: claims.sub, status: "active"
    }).lean();
    if (!membership) throw new AuthError("TENANT_ACCESS_REVOKED", "Active organization membership is required.", 403);
    req.auth = {
      userId: claims.sub, tenantId: claims.tenantId, role: membership.role as Role,
      permissions: rolePermissions[membership.role as Role]
    };
    next();
  } catch (error) { next(error); }
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth?.permissions.includes(permission)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
      return;
    }
    next();
  };
}
