import { Schema, model } from "mongoose";

export const deviceStatuses = ["active", "revoked"] as const;

const deviceSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  facilityId: { type: Schema.Types.ObjectId, ref: "Facility", required: true, index: true },
  assetId: { type: Schema.Types.ObjectId, ref: "EnergyAsset", required: true, index: true },
  deviceCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  credentialHash: { type: String, required: true, select: false },
  status: { type: String, enum: deviceStatuses, default: "active", required: true },
  lastSeenAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

deviceSchema.index({ tenantId: 1, deviceCode: 1 }, { unique: true });
deviceSchema.index({ tenantId: 1, status: 1, lastSeenAt: -1 });
export const TelemetryDevice = model("TelemetryDevice", deviceSchema);
