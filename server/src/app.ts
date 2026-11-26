import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { isDatabaseReady } from "./config/database.js";
import { logger } from "./lib/logger.js";

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
  res.status(200).json({
    status: "ok",
    service: "voltwise-api",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/v1/health/ready", (_req, res) => {
  const databaseReady = isDatabaseReady();
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ready" : "degraded",
    service: "voltwise-api",
    timestamp: new Date().toISOString(),
    checks: {
      api: "ok",
      database: databaseReady ? "connected" : "disconnected"
    }
  });
});

// Backwards-friendly health endpoint reports readiness, not merely process liveness.
app.get("/api/v1/health", (_req, res) => {
  const databaseReady = isDatabaseReady();
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ok" : "degraded",
    service: "voltwise-api",
    timestamp: new Date().toISOString(),
    checks: {
      api: "ok",
      database: databaseReady ? "connected" : "disconnected"
    }
  });
});

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested API route does not exist."
    }
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: error }, "Unhandled request error");
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred."
    }
  });
});
