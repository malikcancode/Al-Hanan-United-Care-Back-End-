import mongoose from "mongoose";

export const ACTIVITY_ENTITIES = ["appointment", "service", "doctor", "message", "settings", "account"];

// Audit trail of admin actions. Entries expire after 180 days.
const activitySchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    adminName: { type: String, trim: true, default: "" },
    action: { type: String, required: true, trim: true }, // e.g. "created", "updated", "deleted", "status"
    entity: { type: String, enum: ACTIVITY_ENTITIES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export default mongoose.model("Activity", activitySchema);
