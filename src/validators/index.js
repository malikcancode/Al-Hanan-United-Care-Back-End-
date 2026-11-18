import { body, param, query } from "express-validator";
import { APPOINTMENT_STATUSES, APPOINTMENT_SOURCES } from "../models/Appointment.js";
import { SERVICE_ICONS } from "../models/Service.js";
import { MESSAGE_STATUSES, MESSAGE_TOPICS } from "../models/Message.js";
import { ACTIVITY_ENTITIES } from "../models/Activity.js";
import { isValidTimezone } from "../utils/dates.js";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^\+?[0-9\s-]{7,20}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const idParam = [param("id").isMongoId().withMessage("Invalid id")];

const idList = (field = "ids") => [
  body(field).isArray({ min: 1, max: 100 }).withMessage("Select between 1 and 100 items"),
  body(`${field}.*`).isMongoId().withMessage("Invalid id"),
];

const pageRules = [
  // No sanitizers on query: Express 5 makes req.query read-only; controllers parse numbers.
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("search").optional().isString().isLength({ max: 100 }),
];

// ---- Auth ----
export const loginRules = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const changePasswordRules = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8, max: 128 })
    .withMessage("New password must be at least 8 characters")
    .bail()
    .matches(/[A-Za-z]/)
    .withMessage("New password must include a letter")
    .bail()
    .matches(/\d/)
    .withMessage("New password must include a number"),
];

// ---- Appointments ----
const preferredDateRule = (field, { allowPast }) =>
  body(field)
    .matches(DAY_RE)
    .withMessage("Choose a preferred date")
    .bail()
    .isISO8601()
    .withMessage("Choose a valid date")
    .bail()
    .custom((value) => {
      if (allowPast) return true;
      // Allow "today" in any timezone the visitor might be in.
      const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString().slice(0, 10);
      if (value < yesterday) throw new Error("Preferred date cannot be in the past");
      return true;
    });

export const createAppointmentRules = [
  body("fullName").trim().isLength({ min: 2, max: 100 }).withMessage("Full name is required"),
  body("phone").trim().matches(PHONE_RE).withMessage("Enter a valid phone or WhatsApp number"),
  body("service").isMongoId().withMessage("Please choose a service"),
  preferredDateRule("preferredDate", { allowPast: false }),
  body("time").optional({ values: "falsy" }).matches(TIME_RE).withMessage("Use a time like 14:30"),
];

export const manualAppointmentRules = [
  body("fullName").trim().isLength({ min: 2, max: 100 }).withMessage("Patient name is required"),
  body("phone").trim().matches(PHONE_RE).withMessage("Enter a valid phone or WhatsApp number"),
  body("service").isMongoId().withMessage("Choose a service"),
  preferredDateRule("preferredDate", { allowPast: true }),
  body("time").optional({ values: "falsy" }).matches(TIME_RE).withMessage("Use a time like 14:30"),
  body("doctor").optional({ values: "falsy" }).isMongoId().withMessage("Choose a doctor"),
  body("source")
    .isIn(APPOINTMENT_SOURCES.filter((s) => s !== "website"))
    .withMessage("Choose how the booking was made"),
  body("status").optional().isIn(APPOINTMENT_STATUSES).withMessage("Invalid status"),
  body("notes").optional().isString().trim().isLength({ max: 1000 }),
];

export const listAppointmentRules = [
  ...pageRules,
  query("status").optional({ values: "falsy" }).isIn(APPOINTMENT_STATUSES),
  query("service").optional({ values: "falsy" }).isMongoId().withMessage("Invalid service"),
  query("doctor")
    .optional({ values: "falsy" })
    .custom((v) => v === "none" || /^[a-f\d]{24}$/i.test(v))
    .withMessage("Invalid doctor"),
  query("source").optional({ values: "falsy" }).isIn(APPOINTMENT_SOURCES),
  query("view").optional({ values: "falsy" }).isIn(["today", "upcoming", "past"]),
  query("from").optional({ values: "falsy" }).matches(DAY_RE).withMessage("Invalid start date"),
  query("to").optional({ values: "falsy" }).matches(DAY_RE).withMessage("Invalid end date"),
  query("sort").optional({ values: "falsy" }).isIn(["newest", "oldest", "date_asc", "date_desc"]),
];

export const updateAppointmentRules = [
  ...idParam,
  body("status").optional().isIn(APPOINTMENT_STATUSES).withMessage("Invalid status"),
  body("notes").optional().isString().trim().isLength({ max: 1000 }),
  body("preferredDate").optional().matches(DAY_RE).withMessage("Invalid date"),
  body("time")
    .optional()
    .custom((v) => v === "" || TIME_RE.test(v))
    .withMessage("Use a time like 14:30"),
  body("doctor")
    .optional({ values: "null" })
    .custom((v) => v === "" || /^[a-f\d]{24}$/i.test(v))
    .withMessage("Invalid doctor"),
];

export const bulkAppointmentRules = [
  ...idList(),
  body("status").isIn(APPOINTMENT_STATUSES).withMessage("Invalid status"),
];

// ---- Messages ----
export const createMessageRules = [
  body("fullName").trim().isLength({ min: 2, max: 100 }).withMessage("Please enter your name"),
  body("phone").trim().matches(PHONE_RE).withMessage("Enter a valid phone or WhatsApp number"),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
  body("topic").optional({ values: "falsy" }).isIn(MESSAGE_TOPICS).withMessage("Choose a topic"),
  body("message")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Please write a little more (at least 10 characters)")
    .bail()
    .isLength({ max: 2000 })
    .withMessage("Please keep your message under 2000 characters"),
];

export const listMessageRules = [...pageRules, query("status").optional({ values: "falsy" }).isIn(MESSAGE_STATUSES)];

export const updateMessageRules = [
  ...idParam,
  body("status").optional().isIn(MESSAGE_STATUSES).withMessage("Invalid status"),
  body("notes").optional().isString().trim().isLength({ max: 1000 }),
];

export const bulkMessageRules = [...idList(), body("status").isIn(MESSAGE_STATUSES).withMessage("Invalid status")];

// ---- Services & doctors ----
export const reorderRules = idList();

export const serviceRules = (optional = false) => {
  const field = (name) => (optional ? body(name).optional() : body(name));
  return [
    field("title").trim().notEmpty().withMessage("Title is required").bail().isLength({ max: 80 }).withMessage("Keep the title under 80 characters"),
    field("description").trim().notEmpty().withMessage("Description is required").bail().isLength({ max: 300 }).withMessage("Keep the description under 300 characters"),
    body("icon").optional().isIn(SERVICE_ICONS).withMessage("Invalid icon"),
    body("order").optional().isInt().toInt(),
    body("isActive").optional().isBoolean().toBoolean(),
  ];
};

export const doctorRules = (optional = false) => {
  const field = (name) => (optional ? body(name).optional() : body(name));
  return [
    field("name").trim().notEmpty().withMessage("Name is required").bail().isLength({ max: 100 }),
    field("specialty").trim().notEmpty().withMessage("Specialty is required").bail().isLength({ max: 100 }),
    body("qualifications").optional().trim().isLength({ max: 150 }),
    body("removePhoto").optional().isIn(["true", "false"]),
    body("order").optional().isInt().toInt(),
    body("isActive").optional().isBoolean().toBoolean(),
  ];
};

// ---- Settings ----
export const settingRules = [
  body(["clinicName", "phone", "whatsapp", "address", "hours"]).optional().isString().trim().isLength({ max: 300 }),
  body("email").optional({ values: "falsy" }).trim().isEmail().withMessage("Invalid email"),
  body("timezone").optional().custom(isValidTimezone).withMessage("Unknown timezone"),
];

// ---- Activity ----
export const listActivityRules = [...pageRules, query("entity").optional({ values: "falsy" }).isIn(ACTIVITY_ENTITIES)];
