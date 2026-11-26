import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../lib/logger.js";

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 20,
    minPoolSize: 2
  });

  logger.info("MongoDB connection established");
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
