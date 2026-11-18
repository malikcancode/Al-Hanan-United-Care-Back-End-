import { Router } from "express";
import { getActivity } from "../controllers/activityController.js";
import { protect } from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import { listActivityRules } from "../validators/index.js";

const router = Router();

router.get("/", protect, listActivityRules, validate, getActivity);

export default router;
