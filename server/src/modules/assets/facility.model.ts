import { Schema, model } from "mongoose";

export const facilityTypes = ["campus", "office", "industrial", "warehouse", "retail", "data_center", "hospital", "other"] as const;
export const facilityStatuses = ["active", "inactive", "maintenance"] as const;

const facilitySchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  parentFacilityId: { type: Schema.Types.ObjectId, ref: "Facility", default: null },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, enum: facilityTypes, required: true },
  status: { type: String, enum: facilityStatuses, default: "active", required: true },
  address: {
    line1: { type: String, trim: true, maxlength: 160 },
    line2: { type: String, trim: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 100 },
    region: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 24 },
    countryCode: { type: String, trim: true, uppercase: true, minlength: 2, maxlength: 2 }
  },
  timezone: { type: String, trim: true, maxlength: 80, default: "UTC" },
  floorArea: { value: { type: Number, min: 0 }, unit: { type: String, enum: ["m2", "ft2"] } },
  notes: { type: String, trim: true, maxlength: 2000 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

facilitySchema.index({ tenantId: 1, code: 1 }, { unique: true });
facilitySchema.index({ tenantId: 1, status: 1, type: 1 });
facilitySchema.index({ tenantId: 1, parentFacilityId: 1 });
export const Facility = model("Facility", facilitySchema);
