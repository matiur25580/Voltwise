import { Router } from "express";
import { isDatabaseReady } from "../config/database.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
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
