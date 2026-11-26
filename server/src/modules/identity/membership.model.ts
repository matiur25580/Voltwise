import { Schema, model } from "mongoose";
import { roles } from "./identity.types.js";

const membershipSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: roles, required: true, default: "viewer" },
  status: { type: String, enum: ["active", "suspended"], default: "active" }
}, { timestamps: true });

membershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
export const Membership = model("Membership", membershipSchema);
