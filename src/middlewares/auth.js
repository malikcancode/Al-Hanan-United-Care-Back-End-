import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import ApiError from "../utils/ApiError.js";

export const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) throw new ApiError(401, "Not authorized, token missing");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "Not authorized, token invalid or expired");
  }

  const admin = await Admin.findById(decoded.id);
  if (!admin) throw new ApiError(401, "Not authorized, account not found");
  if (admin.changedPasswordAfter(decoded.iat)) {
    throw new ApiError(401, "Your password was changed. Please sign in again.");
  }

  req.admin = admin;
  next();
};
