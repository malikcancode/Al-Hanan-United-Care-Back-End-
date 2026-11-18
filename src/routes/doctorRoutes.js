import { Router } from "express";
import {
  getActiveDoctors,
  getAllDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  reorderDoctors,
} from "../controllers/doctorController.js";
import { protect } from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import { imageUpload } from "../middlewares/upload.js";
import { idParam, doctorRules, reorderRules } from "../validators/index.js";

const router = Router();
const photo = imageUpload("doctors").single("photo");

router.get("/", getActiveDoctors);
router.get("/all", protect, getAllDoctors);
router.post("/", protect, photo, doctorRules(), validate, createDoctor);
router.put("/reorder", protect, reorderRules, validate, reorderDoctors);
router.put("/:id", protect, photo, idParam, doctorRules(true), validate, updateDoctor);
router.delete("/:id", protect, idParam, validate, deleteDoctor);

export default router;
