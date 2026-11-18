import Admin from "../models/Admin.js";
import ApiError from "../utils/ApiError.js";
import generateToken from "../utils/generateToken.js";
import { logActivity } from "../utils/activity.js";

const toPublic = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  lastLoginAt: admin.lastLoginAt,
});

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select("+password");

  if (!admin || !(await admin.matchPassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const previousLogin = admin.lastLoginAt;
  admin.lastLoginAt = new Date();
  await admin.save();

  res.json({
    success: true,
    data: { token: generateToken(admin._id), admin: { ...toPublic(admin), lastLoginAt: previousLogin } },
  });
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({ success: true, data: toPublic(req.admin) });
};

// PUT /api/auth/password
// Changing the password signs out every other session; the caller gets a fresh token.
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.admin._id).select("+password");

  if (!(await admin.matchPassword(currentPassword))) {
    throw new ApiError(400, "Current password is incorrect");
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, "The new password must be different from the current one");
  }

  admin.password = newPassword;
  await admin.save();
  logActivity(req, { action: "updated", entity: "account", entityId: admin._id, summary: "Changed account password" });

  res.json({ success: true, message: "Password updated", data: { token: generateToken(admin._id) } });
};
