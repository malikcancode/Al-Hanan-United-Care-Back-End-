import { Router } from "express";
import {
  createAppointment,
  createManualAppointment,
  getAppointments,
  exportAppointments,
  getAppointment,
  updateAppointment,
  bulkUpdateAppointments,
  deleteAppointment,
} from "../controllers/appointmentController.js";
import { protect } from "../middlewares/auth.js";
import { bookingLimiter } from "../middlewares/rateLimit.js";
import validate from "../middlewares/validate.js";
import {
  idParam,
  listAppointmentRules,
  createAppointmentRules,
  manualAppointmentRules,
  updateAppointmentRules,
  bulkAppointmentRules,
} from "../validators/index.js";

const router = Router();

router
  .route("/")
  .post(bookingLimiter, createAppointmentRules, validate, createAppointment)
  .get(protect, listAppointmentRules, validate, getAppointments);

// Static paths must come before "/:id"
router.post("/manual", protect, manualAppointmentRules, validate, createManualAppointment);
router.get("/export", protect, listAppointmentRules, validate, exportAppointments);
router.patch("/bulk", protect, bulkAppointmentRules, validate, bulkUpdateAppointments);

router
  .route("/:id")
  .get(protect, idParam, validate, getAppointment)
  .patch(protect, updateAppointmentRules, validate, updateAppointment)
  .delete(protect, idParam, validate, deleteAppointment);

export default router;
