import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "req.headers.x-device-key", "*.password", "*.token", "*.deviceCredential"],
    censor: "[REDACTED]"
  },
  base: { service: "voltwise-api", environment: env.NODE_ENV }
});
