import mongoose from "mongoose";
import Message from "../models/Message.js";
import ApiError from "../utils/ApiError.js";
import { logActivity } from "../utils/activity.js";
import { notifyInBackground, sendContactEmail } from "../utils/mailer.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SUCCESS_TEXT = "Thank you. We have received your message and will get back to you by phone or WhatsApp.";

// POST /api/messages  (public)
export const createMessage = async (req, res) => {
  // Honeypot: real visitors never see or fill the "website" field.
  if (req.body.website) {
    return res.status(201).json({ success: true, message: SUCCESS_TEXT });
  }

  const { fullName, phone, email, topic, message } = req.body;
  // Save first; the email goes out in the background and can never lose the message.
  const saved = await Message.create({ fullName, phone, email, topic, message });
  notifyInBackground(saved, () => sendContactEmail(saved), "Contact");
  res.status(201).json({ success: true, message: SUCCESS_TEXT });
};

// GET /api/messages  (admin)
export const getMessages = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ fullName: pattern }, { phone: pattern }, { email: pattern }, { message: pattern }];
  }

  const [items, total, unread] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Message.countDocuments(filter),
    Message.countDocuments({ status: "new" }),
  ]);

  res.json({
    success: true,
    data: items,
    unread,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
};

// PATCH /api/messages/:id  (admin)
export const updateMessage = async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) throw new ApiError(404, "Message not found");

  const previous = message.status;
  for (const key of ["status", "notes"]) {
    if (req.body[key] !== undefined) message[key] = req.body[key];
  }
  await message.save();

  // Opening a message (new -> read) is routine; only log meaningful changes.
  if (message.status === "replied" && previous !== "replied") {
    logActivity(req, { action: "status", entity: "message", entityId: message._id, summary: `Replied to message from ${message.fullName}` });
  }
  res.json({ success: true, data: message });
};

// PATCH /api/messages/bulk  (admin)  { ids: [], status }
export const bulkUpdateMessages = async (req, res) => {
  const { ids, status } = req.body;
  const result = await Message.updateMany(
    { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }, status: { $ne: status } },
    { $set: { status } }
  );
  if (result.modifiedCount && status === "replied") {
    logActivity(req, { action: "status", entity: "message", summary: `Marked ${result.modifiedCount} messages as replied` });
  }
  res.json({ success: true, data: { updated: result.modifiedCount } });
};

// DELETE /api/messages/:id  (admin)
export const deleteMessage = async (req, res) => {
  const message = await Message.findByIdAndDelete(req.params.id);
  if (!message) throw new ApiError(404, "Message not found");
  logActivity(req, { action: "deleted", entity: "message", entityId: message._id, summary: `Deleted message from ${message.fullName}` });
  res.json({ success: true, message: "Message deleted" });
};
