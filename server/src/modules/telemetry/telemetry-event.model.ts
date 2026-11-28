import { Schema, model } from "mongoose";

const measurementSchema = new Schema({
  metric: { type: String, required: true, maxlength: 48 },
  value: { type: Number, required: true, min: -1000000000, max: 1000000000 },
  unit: { type: String, required: true, maxlength: 24 },
  quality: { type: String, enum: ["good", "estimated", "suspect"], default: "good" }
}, { _id: false });

const telemetryEventSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  facilityId: { type: Schema.Types.ObjectId, ref: "Facility", required: true },
  assetId: { type: Schema.Types.ObjectId, ref: "EnergyAsset", required: true },
  deviceId: { type: Schema.Types.ObjectId, ref: "TelemetryDevice", required: true },
  eventId: { type: String, required: true, maxlength: 120 },
  occurredAt: { type: Date, required: true },
  receivedAt: { type: Date, required: true, default: Date.now },
  readings: { type: [measurementSchema], required: true, validate: (items: unknown[]) => items.length > 0 && items.length <= 50 }
}, { versionKey: false });

telemetryEventSchema.index({ tenantId: 1, deviceId: 1, eventId: 1 }, { unique: true });
telemetryEventSchema.index({ tenantId: 1, occurredAt: -1 });
telemetryEventSchema.index({ tenantId: 1, assetId: 1, occurredAt: -1 });
export const TelemetryEvent = model("TelemetryEvent", telemetryEventSchema);
