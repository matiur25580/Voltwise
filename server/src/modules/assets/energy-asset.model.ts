import { Schema, model } from "mongoose";

export const energyAssetTypes = ["meter", "solar_pv", "inverter", "battery", "ev_charger", "hvac", "generator", "transformer", "other"] as const;
export const energyAssetStatuses = ["active", "inactive", "maintenance", "decommissioned"] as const;

const energyAssetSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  facilityId: { type: Schema.Types.ObjectId, ref: "Facility", required: true, index: true },
  assetTag: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, enum: energyAssetTypes, required: true },
  status: { type: String, enum: energyAssetStatuses, default: "active", required: true },
  serialNumber: { type: String, trim: true, maxlength: 120 },
  manufacturer: { type: String, trim: true, maxlength: 120 },
  model: { type: String, trim: true, maxlength: 120 },
  capacity: { value: { type: Number, min: 0 }, unit: { type: String, trim: true, maxlength: 24 } },
  commissionedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

energyAssetSchema.index({ tenantId: 1, assetTag: 1 }, { unique: true });
energyAssetSchema.index({ tenantId: 1, facilityId: 1, type: 1, status: 1 });
energyAssetSchema.index({ tenantId: 1, serialNumber: 1 }, { sparse: true });
export const EnergyAsset = model("EnergyAsset", energyAssetSchema);
