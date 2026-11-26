import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { z } from "zod";
import { AuthError } from "../identity/auth.service.js";
import { TelemetryDevice } from "./device.model.js";
import { TelemetryEvent } from "./telemetry-event.model.js";

const measurementSchema = z.object({
  metric: z.enum(["active_power", "energy_import", "energy_export", "voltage", "current", "frequency", "power_factor", "temperature", "state_of_charge", "generation_power", "battery_power"]),
  value: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  unit: z.enum(["W", "kW", "Wh", "kWh", "V", "A", "Hz", "%", "C", "kvar", "kVA"]),
  quality: z.enum(["good", "estimated", "suspect"]).optional()
});
export const telemetryPayloadSchema = z.object({
  eventId: z.string().trim().min(8).max(120),
  timestamp: z.coerce.date(),
  readings: z.array(measurementSchema).min(1).max(50)
}).strict();
export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;

export const telemetryEvents = new EventEmitter();
telemetryEvents.setMaxListeners(0);

export function createDeviceCredential() {
  const credential = randomBytes(32).toString("base64url");
  return { credential, credentialHash: createHash("sha256").update(credential).digest("hex") };
}

export async function ingestTelemetry(deviceCode: string, credential: string, rawPayload: unknown) {
  const payload = telemetryPayloadSchema.parse(rawPayload);
  const device = await TelemetryDevice.findOne({ deviceCode: deviceCode.toUpperCase(), status: "active" })
    .select("+credentialHash");
  if (!device || credential.length !== 43) throw new AuthError("DEVICE_UNAUTHENTICATED", "A valid active device credential is required.", 401);
  const candidate = createHash("sha256").update(credential).digest();
  const stored = Buffer.from(device.credentialHash, "hex");
  if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) {
    throw new AuthError("DEVICE_UNAUTHENTICATED", "A valid active device credential is required.", 401);
  }
  const now = Date.now();
  const occurredAt = payload.timestamp.getTime();
  if (occurredAt > now + 5 * 60_000 || occurredAt < now - 7 * 24 * 60 * 60_000) {
    throw new AuthError("TELEMETRY_TIMESTAMP_OUT_OF_RANGE", "Telemetry timestamp must be within the last seven days and no more than five minutes in the future.", 400);
  }
  const normalized = {
    tenantId: device.tenantId, facilityId: device.facilityId, assetId: device.assetId,
    deviceId: device._id, eventId: payload.eventId, occurredAt: payload.timestamp,
    readings: payload.readings.map((reading) => ({ ...reading, quality: reading.quality ?? "good" }))
  };
  try {
    const event = await TelemetryEvent.create(normalized);
    device.lastSeenAt = new Date();
    await device.save();
    const publicEvent = event.toObject();
    telemetryEvents.emit("reading", { tenantId: device.tenantId.toString(), event: publicEvent });
    return { accepted: true, duplicate: false, eventId: payload.eventId };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      device.lastSeenAt = new Date();
      await device.save();
      return { accepted: true, duplicate: true, eventId: payload.eventId };
    }
    throw error;
  }
}
