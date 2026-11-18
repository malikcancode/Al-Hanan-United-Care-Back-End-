import { Router } from "express";
import {
  getActiveServices,
  getAllServices,
  createService,
  updateService,
  deleteService,
  reorderServices,
} from "../controllers/serviceController.js";
import { protect } from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import { idParam, serviceRules, reorderRules } from "../validators/index.js";

const router = Router();

router.get("/", getActiveServices);
router.get("/all", protect, getAllServices);
router.post("/", protect, serviceRules(), validate, createService);
router.put("/reorder", protect, reorderRules, validate, reorderServices);
router.put("/:id", protect, idParam, serviceRules(true), validate, updateService);
router.delete("/:id", protect, idParam, validate, deleteService);

export default router;
