import Service from "../models/Service.js";
import Appointment from "../models/Appointment.js";
import ApiError from "../utils/ApiError.js";
import { logActivity } from "../utils/activity.js";
import { applyOrder } from "../utils/reorder.js";

const FIELDS = ["title", "description", "icon", "order", "isActive"];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// GET /api/services  (public, active only)
export const getActiveServices = async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, data: services });
};

// GET /api/services/all  (admin) — includes how many appointments each service has
export const getAllServices = async (req, res) => {
  const [services, counts] = await Promise.all([
    Service.find().sort({ order: 1, createdAt: 1 }).lean(),
    Appointment.aggregate([{ $group: { _id: "$service", total: { $sum: 1 } } }]),
  ]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.total]));
  res.json({ success: true, data: services.map((s) => ({ ...s, appointmentCount: byId[String(s._id)] || 0 })) });
};

// POST /api/services  (admin)
export const createService = async (req, res) => {
  const data = pick(req.body);
  if (data.order === undefined) {
    const last = await Service.findOne().sort({ order: -1 }).select("order").lean();
    data.order = (last?.order || 0) + 1;
  }
  const service = await Service.create(data);
  logActivity(req, { action: "created", entity: "service", entityId: service._id, summary: `Added service “${service.title}”` });
  res.status(201).json({ success: true, data: service });
};

// PUT /api/services/:id  (admin)
export const updateService = async (req, res) => {
  const before = await Service.findById(req.params.id).lean();
  if (!before) throw new ApiError(404, "Service not found");

  const service = await Service.findByIdAndUpdate(req.params.id, pick(req.body), { new: true, runValidators: true });

  const visibility =
    req.body.isActive !== undefined && req.body.isActive !== before.isActive
      ? service.isActive
        ? " (now visible)"
        : " (now hidden)"
      : "";
  logActivity(req, { action: "updated", entity: "service", entityId: service._id, summary: `Updated service “${service.title}”${visibility}` });
  res.json({ success: true, data: service });
};

// PUT /api/services/reorder  (admin)  { ids: [...] in display order }
export const reorderServices = async (req, res) => {
  await applyOrder(Service, req.body.ids);
  logActivity(req, { action: "updated", entity: "service", summary: "Changed the order of services" });
  res.json({ success: true, message: "Order saved" });
};

// DELETE /api/services/:id  (admin)
export const deleteService = async (req, res) => {
  const inUse = await Appointment.exists({ service: req.params.id });
  if (inUse) {
    throw new ApiError(409, "This service has appointments, so it can't be deleted. Hide it instead.");
  }

  const service = await Service.findByIdAndDelete(req.params.id);
  if (!service) throw new ApiError(404, "Service not found");
  logActivity(req, { action: "deleted", entity: "service", entityId: service._id, summary: `Deleted service “${service.title}”` });
  res.json({ success: true, message: "Service deleted" });
};
