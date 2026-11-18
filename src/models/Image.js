import mongoose from "mongoose";

// Uploaded images live in MongoDB so they survive on hosts without a persistent disk (e.g. Vercel).
const imageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    folder: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Image", imageSchema);
