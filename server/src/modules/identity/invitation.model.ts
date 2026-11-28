import { Schema, model } from "mongoose";
import { roles } from "./identity.types.js";

const invitationSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  role: { type: String, enum: roles.filter((role) => role !== "owner"), required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending", index: true },
  expiresAt: { type: Date, required: true, index: true },
  acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  acceptedAt: { type: Date, default: null }
}, { timestamps: true });

invitationSchema.index({ tenantId: 1, email: 1, status: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export const OrganizationInvitation = model("OrganizationInvitation", invitationSchema);
