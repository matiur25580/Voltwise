import { Schema, model } from "mongoose";
const intervalSchema = new Schema({
  index: { type: Number, required: true }, baselineLoadKw: { type: Number, required: true },
  recommendedDischargeKw: { type: Number, required: true }, optimizedLoadKw: { type: Number, required: true },
  remainingEnergyKwh: { type: Number, required: true }, avoidedEnergyKwh: { type: Number, required: true }
}, { _id: false });
const flexibilityPlanSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  facilityId: { type: Schema.Types.ObjectId, ref: "Facility", default: null },
  batteryAssetIds: [{ type: Schema.Types.ObjectId, ref: "EnergyAsset", required: true }],
  name: { type: String, required: true, trim: true, maxlength: 120 },
  intervalMinutes: { type: Number, required: true }, targetDemandKw: { type: Number, required: true },
  initialSocPercent: { type: Number, required: true }, reserveSocPercent: { type: Number, required: true },
  batteryCapacityKwh: { type: Number, required: true }, maxDischargeKw: { type: Number, required: true },
  baselineLoadKw: { type: [Number], required: true }, tariffRatesPerKwh: { type: [Number], default: [] },
  schedule: { type: [intervalSchema], required: true },
  summary: {
    baselinePeakKw: { type: Number, required: true }, optimizedPeakKw: { type: Number, required: true },
    avoidedEnergyKwh: { type: Number, required: true }, estimatedCostAvoidedInr: { type: Number, default: null }
  },
  status: { type: String, enum: ["proposed", "approved", "rejected"], default: "proposed", required: true },
  decisionNote: { type: String, trim: true, maxlength: 1000, default: "" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
flexibilityPlanSchema.index({ tenantId: 1, createdAt: -1 });
flexibilityPlanSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
export const FlexibilityPlan = model("FlexibilityPlan", flexibilityPlanSchema);
