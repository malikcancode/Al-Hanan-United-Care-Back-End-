import mongoose from "mongoose";
import { DEFAULT_TIMEZONE, isValidTimezone } from "../utils/dates.js";

const settingSchema = new mongoose.Schema(
  {
    clinicName: { type: String, default: "Al Hanna United Care", trim: true },
    phone: { type: String, default: "", trim: true },
    whatsapp: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    hours: { type: String, default: "", trim: true },
    timezone: {
      type: String,
      default: DEFAULT_TIMEZONE,
      validate: { validator: isValidTimezone, message: "Unknown timezone" },
    },
  },
  { timestamps: true }
);

settingSchema.statics.getSingleton = async function () {
  return (await this.findOne()) || this.create({});
};

settingSchema.statics.getTimezone = async function () {
  const s = await this.findOne().select("timezone").lean();
  return s?.timezone && isValidTimezone(s.timezone) ? s.timezone : DEFAULT_TIMEZONE;
};

export default mongoose.model("Setting", settingSchema);
