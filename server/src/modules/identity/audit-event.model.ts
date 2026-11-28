import { Schema, model } from "mongoose";

const auditEventSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, required: true, maxlength: 100 },
  resourceType: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, required: true, maxlength: 100 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  occurredAt: { type: Date, required: true, default: Date.now, index: true }
}, { versionKey: false });

auditEventSchema.index({ tenantId: 1, occurredAt: -1 });
export const AuditEvent = model("AuditEvent", auditEventSchema);
