import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import multer from "multer";
import Image from "../models/Image.js";
import ApiError from "../utils/ApiError.js";

// Older local uploads were written here; new ones are stored in MongoDB.
export const UPLOADS_ROOT = path.resolve("uploads");

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const imageUpload = () =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
      else cb(new ApiError(400, "Only JPG, PNG or WEBP images are allowed"));
    },
  });

// Saves the uploaded file and returns its public path, e.g. "/uploads/<id>".
export const saveUpload = async (file, folder) => {
  if (!file) return undefined;
  const image = await Image.create({ data: file.buffer, contentType: file.mimetype, size: file.size, folder });
  return `/uploads/${image._id}`;
};

export const removeUpload = async (publicPath) => {
  if (!publicPath?.startsWith("/uploads/")) return;
  const rest = publicPath.slice("/uploads/".length);

  if (mongoose.isValidObjectId(rest)) {
    await Image.deleteOne({ _id: rest }).catch(() => {});
    return;
  }

  const filePath = path.join(UPLOADS_ROOT, rest);
  if (!filePath.startsWith(UPLOADS_ROOT)) return;
  await fs.promises.unlink(filePath).catch(() => {});
};

// GET /uploads/:id
export const serveUpload = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next();
  const image = await Image.findById(req.params.id).lean();
  if (!image) return next();

  res.set({
    "Content-Type": image.contentType,
    "Content-Length": image.size,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  res.send(Buffer.from(image.data.buffer ?? image.data));
};
