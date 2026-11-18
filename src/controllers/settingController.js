import Setting from "../models/Setting.js";
import { logActivity } from "../utils/activity.js";

const FIELDS = ["clinicName", "phone", "whatsapp", "email", "address", "hours", "timezone"];

// GET /api/settings  (public)
export const getSettings = async (req, res) => {
  const settings = await Setting.getSingleton();
  res.json({ success: true, data: settings });
};

// PUT /api/settings  (admin)
export const updateSettings = async (req, res) => {
  const settings = await Setting.getSingleton();
  const changed = [];
  for (const key of FIELDS) {
    if (req.body[key] !== undefined && req.body[key] !== settings[key]) {
      settings[key] = req.body[key];
      changed.push(key);
    }
  }
  await settings.save();

  if (changed.length) {
    logActivity(req, {
      action: "updated",
      entity: "settings",
      entityId: settings._id,
      summary: `Updated clinic settings (${changed.join(", ")})`,
    });
  }
  res.json({ success: true, data: settings });
};
