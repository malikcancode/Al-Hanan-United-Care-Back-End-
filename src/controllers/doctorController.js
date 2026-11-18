import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import ApiError from "../utils/ApiError.js";
import { removeUpload } from "../middlewares/upload.js";
import { logActivity } from "../utils/activity.js";
import { applyOrder } from "../utils/reorder.js";

const FIELDS = ["name", "specialty", "qualifications", "order", "isActive"];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

const uploadedPath = (file) => (file ? `/uploads/doctors/${file.filename}` : undefined);

// GET /api/doctors  (public, active only)
export const getActiveDoctors = async (req, res) => {
  const doctors = await Doctor.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, data: doctors });
};

// GET /api/doctors/all  (admin) — includes assigned and upcoming appointment counts
export const getAllDoctors = async (req, res) => {
  const [doctors, counts] = await Promise.all([
    Doctor.find().sort({ order: 1, createdAt: 1 }).lean(),
    Appointment.aggregate([
      { $match: { doctor: { $ne: null } } },
      {
        $group: {
          _id: "$doctor",
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ["$status", ["pending", "confirmed"]] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  res.json({
    success: true,
    data: doctors.map((d) => ({
      ...d,
      appointmentCount: byId[String(d._id)]?.total || 0,
      openAppointmentCount: byId[String(d._id)]?.open || 0,
    })),
  });
};

// POST /api/doctors  (admin, multipart: optional "photo")
export const createDoctor = async (req, res) => {
  const data = { ...pick(req.body), photoUrl: uploadedPath(req.file) || "" };
  if (data.order === undefined) {
    const last = await Doctor.findOne().sort({ order: -1 }).select("order").lean();
    data.order = (last?.order || 0) + 1;
  }
  const doctor = await Doctor.create(data);
  logActivity(req, { action: "created", entity: "doctor", entityId: doctor._id, summary: `Added doctor ${doctor.name}` });
  res.status(201).json({ success: true, data: doctor });
};

// PUT /api/doctors/:id  (admin, multipart: optional "photo", optional "removePhoto")
export const updateDoctor = async (req, res) => {
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new ApiError(404, "Doctor not found");

  const oldPhoto = doctor.photoUrl;
  doctor.set(pick(req.body));

  if (req.file) doctor.photoUrl = uploadedPath(req.file);
  else if (req.body.removePhoto === "true") doctor.photoUrl = "";

  await doctor.save();
  if (oldPhoto !== doctor.photoUrl) await removeUpload(oldPhoto);

  logActivity(req, { action: "updated", entity: "doctor", entityId: doctor._id, summary: `Updated doctor ${doctor.name}` });
  res.json({ success: true, data: doctor });
};

// PUT /api/doctors/reorder  (admin)  { ids: [...] in display order }
export const reorderDoctors = async (req, res) => {
  await applyOrder(Doctor, req.body.ids);
  logActivity(req, { action: "updated", entity: "doctor", summary: "Changed the order of doctors" });
  res.json({ success: true, message: "Order saved" });
};

// DELETE /api/doctors/:id  (admin)
// Past appointments keep working: their doctor link is cleared.
export const deleteDoctor = async (req, res) => {
  const open = await Appointment.countDocuments({ doctor: req.params.id, status: { $in: ["pending", "confirmed"] } });
  if (open) {
    throw new ApiError(
      409,
      `This doctor has ${open} open appointment${open === 1 ? "" : "s"}. Reassign ${open === 1 ? "it" : "them"} or hide the doctor instead.`
    );
  }

  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  if (!doctor) throw new ApiError(404, "Doctor not found");
  await Appointment.updateMany({ doctor: doctor._id }, { $set: { doctor: null } });
  await removeUpload(doctor.photoUrl);

  logActivity(req, { action: "deleted", entity: "doctor", entityId: doctor._id, summary: `Removed doctor ${doctor.name}` });
  res.json({ success: true, message: "Doctor deleted" });
};
