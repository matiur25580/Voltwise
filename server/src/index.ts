import mongoose from "mongoose";
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";\nimport { startMqttAdapter, stopMqttAdapter } from "./modules/telemetry/mqtt.adapter.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Voltwise API started");
});

void connectDatabase().then(() => {\n  startMqttAdapter(env.MQTT_BROKER_URL, env.MQTT_USERNAME, env.MQTT_PASSWORD);\n}).catch((error: unknown) => {
  logger.error({ err: error }, "MongoDB connection failed; readiness checks will remain degraded");
});

let shuttingDown = false;

const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutdown signal received");

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "HTTP server shutdown failed");
      process.exitCode = 1;
    }
    void stopMqttAdapter().finally(() => mongoose.disconnect()).finally(() => process.exit());
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
