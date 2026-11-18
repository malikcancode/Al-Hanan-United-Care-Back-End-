import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import ApiError from "../utils/ApiError.js";

export const UPLOADS_ROOT = path.resolve("uploads");

const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const imageUpload = (folder) => {
  const dir = path.join(UPLOADS_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ALLOWED_TYPES[file.mimetype]}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
      else cb(new ApiError(400, "Only JPG, PNG or WEBP images are allowed"));
    },
  });
};

export const removeUpload = async (publicPath) => {
  if (!publicPath?.startsWith("/uploads/")) return;
  const filePath = path.join(UPLOADS_ROOT, publicPath.replace(/^\/uploads\//, ""));
  if (!filePath.startsWith(UPLOADS_ROOT)) return;
  await fs.promises.unlink(filePath).catch(() => {});
};
