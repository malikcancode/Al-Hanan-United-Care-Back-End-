import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import Doctor from "../models/Doctor.js";
import Setting from "../models/Setting.js";
import ApiError from "../utils/ApiError.js";
import { logActivity } from "../utils/activity.js";
import { notifyInBackground, sendAppointmentEmail } from "../utils/mailer.js";
import { clinicToday, dayFromKey } from "../utils/dates.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toDay = (value) => dayFromKey(String(value).slice(0, 10));
const POPULATE = [
  { path: "service", select: "title" },
  { path: "doctor", select: "name specialty" },
];

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  date_asc: { preferredDate: 1, time: 1, createdAt: 1 },
  date_desc: { preferredDate: -1, time: -1, createdAt: -1 },
};

// Shared by the list and the CSV export so both always agree.
const buildFilter = async (query) => {
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.service) filter.service = query.service;
  if (query.doctor === "none") filter.doctor = null;
  else if (query.doctor) filter.doctor = query.doctor;
  if (query.source) filter.source = query.source;

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ fullName: pattern }, { phone: pattern }];
  }

  const range = {};
  if (query.from) range.$gte = toDay(query.from);
  if (query.to) range.$lte = toDay(query.to);

  if (query.view) {
    const today = clinicToday(await Setting.getTimezone());
    if (query.view === "today") Object.assign(range, { $gte: today, $lte: today });
    if (query.view === "upcoming") range.$gt = today;
    if (query.view === "past") range.$lt = today;
  }
  if (Object.keys(range).length) filter.preferredDate = range;

  return filter;
};

const ensureService = async (id, { activeOnly }) => {
  const exists = await Service.exists(activeOnly ? { _id: id, isActive: true } : { _id: id });
  if (!exists) throw new ApiError(400, "Selected service is not available", [{ field: "service", message: "Selected service is not available" }]);
};

const ensureDoctor = async (id) => {
  if (!id) return;
  if (!(await Doctor.exists({ _id: id }))) {
    throw new ApiError(400, "Selected doctor was not found", [{ field: "doctor", message: "Selected doctor was not found" }]);
  }
};

// POST /api/appointments  (public, from the website)
export const createAppointment = async (req, res) => {
  const { fullName, phone, service, preferredDate, time } = req.body;
  await ensureService(service, { activeOnly: true });

  // Save first; the email goes out in the background and can never lose the booking.
  const appointment = await Appointment.create({
    fullName,
    phone,
    service,
    preferredDate: toDay(preferredDate),
    time: time || "",
    source: "website",
    history: [{ status: "pending", by: "Website" }],
  });

  const serviceDoc = await Service.findById(service).select("title").lean();
  notifyInBackground(appointment, () => sendAppointmentEmail(appointment, { serviceTitle: serviceDoc?.title }), "Appointment");

  res.status(201).json({
    success: true,
    message: "Appointment requested. We will confirm your time by phone or WhatsApp.",
    data: { _id: appointment._id },
  });
};

// POST /api/appointments/manual  (admin: phone, WhatsApp or walk-in bookings)
export const createManualAppointment = async (req, res) => {
  const { fullName, phone, service, preferredDate, time, doctor, source, status = "confirmed", notes } = req.body;
  await ensureService(service, { activeOnly: false });
  await ensureDoctor(doctor);

  const appointment = await Appointment.create({
    fullName,
    phone,
    service,
    preferredDate: toDay(preferredDate),
    time: time || "",
    doctor: doctor || null,
    source,
    status,
    notes: notes || "",
    history: [{ status, by: req.admin.name }],
  });
  await appointment.populate(POPULATE);

  logActivity(req, {
    action: "created",
    entity: "appointment",
    entityId: appointment._id,
    summary: `Added ${source} appointment for ${fullName}`,
  });
  res.status(201).json({ success: true, data: appointment });
};

// GET /api/appointments  (admin)
export const getAppointments = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const filter = await buildFilter(req.query);
  const sort = SORTS[req.query.sort] || SORTS.newest;

  const [items, total] = await Promise.all([
    Appointment.find(filter).populate(POPULATE).sort(sort).skip((page - 1) * limit).limit(limit),
    Appointment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
};

// GET /api/appointments/export  (admin, CSV of the current filters)
export const exportAppointments = async (req, res) => {
  const filter = await buildFilter(req.query);
  const sort = SORTS[req.query.sort] || SORTS.newest;
  const rows = await Appointment.find(filter).populate(POPULATE).sort(sort).limit(5000).lean();

  // Quote every cell; neutralise values a spreadsheet would run as a formula.
  const cell = (value) => {
    let s = value == null ? "" : String(value);
    if (/^[=@\t\r]/.test(s) || /^[+-](?![\d\s]+$)/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  const header = ["Patient", "Phone", "Service", "Preferred date", "Time", "Doctor", "Status", "Source", "Notes", "Requested at"];
  const lines = rows.map((a) =>
    [
      a.fullName,
      a.phone,
      a.service?.title,
      day(a.preferredDate),
      a.time,
      a.doctor?.name,
      a.status,
      a.source,
      a.notes,
      a.createdAt ? new Date(a.createdAt).toISOString() : "",
    ]
      .map(cell)
      .join(",")
  );

  const filename = `appointments-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`);
};

// GET /api/appointments/:id  (admin)
export const getAppointment = async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate(POPULATE);
  if (!appointment) throw new ApiError(404, "Appointment not found");
  res.json({ success: true, data: appointment });
};

// PATCH /api/appointments/:id  (admin)
export const updateAppointment = async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new ApiError(404, "Appointment not found");

  const { status, notes, preferredDate, time, doctor } = req.body;
  const changes = [];

  if (doctor !== undefined) {
    await ensureDoctor(doctor);
    const next = doctor || null;
    if (String(appointment.doctor || "") !== String(next || "")) {
      appointment.doctor = next;
      changes.push(next ? "assigned doctor" : "removed doctor");
    }
  }
  if (preferredDate !== undefined) {
    const next = toDay(preferredDate);
    if (next.getTime() !== appointment.preferredDate.getTime()) {
      appointment.preferredDate = next;
      changes.push(`rescheduled to ${String(preferredDate).slice(0, 10)}`);
    }
  }
  if (time !== undefined && time !== appointment.time) {
    appointment.time = time;
    changes.push(time ? `time ${time}` : "cleared time");
  }
  if (notes !== undefined && notes !== appointment.notes) {
    appointment.notes = notes;
    changes.push("notes");
  }
  if (status !== undefined && status !== appointment.status) {
    appointment.status = status;
    appointment.history.push({ status, by: req.admin.name });
    changes.unshift(`marked ${status}`);
  }

  await appointment.save();
  await appointment.populate(POPULATE);

  if (changes.length) {
    logActivity(req, {
      action: changes[0].startsWith("marked") ? "status" : "updated",
      entity: "appointment",
      entityId: appointment._id,
      summary: `${appointment.fullName}: ${changes.join(", ")}`,
    });
  }
  res.json({ success: true, data: appointment });
};

// PATCH /api/appointments/bulk  (admin)  { ids: [], status }
export const bulkUpdateAppointments = async (req, res) => {
  const { ids, status } = req.body;
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

  const result = await Appointment.updateMany(
    { _id: { $in: objectIds }, status: { $ne: status } },
    { $set: { status }, $push: { history: { status, by: req.admin.name, at: new Date() } } }
  );

  if (result.modifiedCount) {
    logActivity(req, {
      action: "status",
      entity: "appointment",
      summary: `Marked ${result.modifiedCount} appointment${result.modifiedCount === 1 ? "" : "s"} as ${status}`,
    });
  }
  res.json({ success: true, data: { updated: result.modifiedCount } });
};

// DELETE /api/appointments/:id  (admin)
export const deleteAppointment = async (req, res) => {
  const appointment = await Appointment.findByIdAndDelete(req.params.id);
  if (!appointment) throw new ApiError(404, "Appointment not found");
  logActivity(req, {
    action: "deleted",
    entity: "appointment",
    entityId: appointment._id,
    summary: `Deleted appointment request from ${appointment.fullName}`,
  });
  res.json({ success: true, message: "Appointment deleted" });
};
