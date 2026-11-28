import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/voltwise"),
  JWT_ACCESS_SECRET: z.string().min(32).default("local-development-secret-change-before-deploy-000000"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  MQTT_BROKER_URL: z.string().url().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === "production" && parsed.data.JWT_ACCESS_SECRET.startsWith("local-development")) {
  console.error("JWT_ACCESS_SECRET must be set to a unique secret in production.");
  process.exit(1);
}

if (parsed.data.NODE_ENV === "production" && parsed.data.MQTT_BROKER_URL && !parsed.data.MQTT_BROKER_URL.startsWith("mqtts://")) {
  console.error("MQTT_BROKER_URL must use mqtts:// in production.");
  process.exit(1);
}

export const env = parsed.data;
