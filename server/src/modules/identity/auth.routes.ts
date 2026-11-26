import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import type { CookieOptions, Request, Response } from "express";
import { AuthError, login, register, revokeRefreshToken, rotateRefreshToken } from "./auth.service.js";
import { requireAuth, type AuthenticatedRequest } from "./auth.middleware.js";
import { User } from "./user.model.js";
import { env } from "../../config/env.js";

export const authRouter = Router();
authRouter.use(rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  standardHeaders: "draft-8", legacyHeaders: false
}));
const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 UTF-8 bytes."),
  organizationName: z.string().trim().min(2).max(120)
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
const cookieOptions: CookieOptions = {
  httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax",
  path: "/api/v1/auth", maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
};
const readRefreshCookie = (req: Request) => {
  const raw = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("voltwise_refresh="));
  return raw ? decodeURIComponent(raw.slice("voltwise_refresh=".length)) : undefined;
};
const setRefreshCookie = (res: Response, token: string) => res.cookie("voltwise_refresh", token, cookieOptions);
const clearRefreshCookie = (res: Response) => res.clearCookie("voltwise_refresh", {
  httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth"
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await register(input);
    setRefreshCookie(res, result.session.refreshToken);
    res.status(201).json({
      data: {
        accessToken: result.session.accessToken,
        user: { id: result.user.id, name: result.user.name, email: result.user.email },
        organization: { id: result.organization.id, name: result.organization.name, slug: result.organization.slug }
      }
    });
  } catch (error) { next(error); }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input.email, input.password);
    setRefreshCookie(res, result.session.refreshToken);
    res.json({
      data: {
        accessToken: result.session.accessToken,
        user: { id: result.user.id, name: result.user.name, email: result.user.email },
        organization: { id: result.membership.tenantId.toString(), role: result.membership.role }
      }
    });
  } catch (error) { next(error); }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = readRefreshCookie(req);
    if (!token) throw new AuthError("REFRESH_TOKEN_REQUIRED", "Refresh token cookie is required.");
    const session = await rotateRefreshToken(token);
    setRefreshCookie(res, session.refreshToken);
    res.json({ data: { accessToken: session.accessToken } });
  } catch (error) { clearRefreshCookie(res); next(error); }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = readRefreshCookie(req);
    if (token) await revokeRefreshToken(token);
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId).select("name email");
    if (!user) throw new AuthError("USER_NOT_FOUND", "Account no longer exists.", 404);
    res.json({ data: { user: { id: user.id, name: user.name, email: user.email }, tenant: req.auth!.tenantId, role: req.auth!.role, permissions: req.auth!.permissions } });
  } catch (error) { next(error); }
});
