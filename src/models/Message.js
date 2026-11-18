import mongoose from "mongoose";

export const MESSAGE_STATUSES = ["new", "read", "replied"];
export const MESSAGE_TOPICS = ["general", "appointment", "prescription", "reports", "other"];

const messageSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    topic: { type: String, enum: MESSAGE_TOPICS, default: "general" },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: MESSAGE_STATUSES, default: "new" },
    notes: { type: String, trim: true, default: "" },
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

messageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
