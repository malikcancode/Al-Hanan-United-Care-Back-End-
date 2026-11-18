import mongoose from "mongoose";

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled"];
export const APPOINTMENT_SOURCES = ["website", "phone", "whatsapp", "walk-in"];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    by: { type: String, trim: true, default: "" }, // admin name, or "Website"
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    preferredDate: { type: Date, required: true },
    // Set by staff once the slot is agreed with the patient, "HH:mm" 24h
    time: { type: String, trim: true, default: "" },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    source: { type: String, enum: APPOINTMENT_SOURCES, default: "website" },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: "pending" },
    notes: { type: String, trim: true, default: "" },
    history: { type: [historySchema], default: [] },
    // Outcome of the email sent to the clinic inbox (see utils/mailer.js)
    emailNotification: {
      sent: { type: Boolean },
      at: { type: Date },
      messageId: { type: String },
      error: { type: String },
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ status: 1, createdAt: -1 });
appointmentSchema.index({ preferredDate: 1 });
appointmentSchema.index({ service: 1 });
appointmentSchema.index({ doctor: 1 });

export default mongoose.model("Appointment", appointmentSchema);
