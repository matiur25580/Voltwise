import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { isDatabaseReady } from "./config/database.js";
import { logger } from "./lib/logger.js";
import { authRouter, organizationRouter } from "./modules/identity/index.js";
import { AuthError } from "./modules/identity/auth.service.js";
import { telemetryRouter } from "./modules/telemetry/telemetry.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { assetRouter } from "./modules/assets/asset.routes.js";
import { flexibilityRouter } from "./modules/flexibility/flexibility.routes.js";
import { tariffOptimizationRouter } from "./modules/flexibility/tariff-optimization.routes.js";
import { ZodError } from "zod";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

app.get("/api/v1/health/live", (_req, res) => {
  res.status(200).json({ status: "ok", service: "voltwise-api", timestamp: new Date().toISOString() });
});

app.get("/api/v1/health/ready", (_req, res) => {
  const databaseReady = isDatabaseReady();
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ready" : "degraded", service: "voltwise-api",
    timestamp: new Date().toISOString(),
    checks: { api: "ok", database: databaseReady ? "connected" : "disconnected" }
  });
});

app.get("/api/v1/health", (_req, res) => {
  const databaseReady = isDatabaseReady();
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ok" : "degraded", service: "voltwise-api",
    timestamp: new Date().toISOString(),
    checks: { api: "ok", database: databaseReady ? "connected" : "disconnected" }
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/organizations", organizationRouter);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", telemetryRouter);
app.use("/api/v1", assetRouter);
app.use("/api/v1", flexibilityRouter);
app.use("/api/v1", tariffOptimizationRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "The requested API route does not exist." } });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: error.flatten().fieldErrors } });
    return;
  }
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    res.status(409).json({ error: { code: "RESOURCE_CONFLICT", message: "A resource with these details already exists." } });
    return;
  }
  logger.error({ err: error }, "Unhandled request error");
  res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } });
});
