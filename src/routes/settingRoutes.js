import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingController.js";
import { protect } from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import { settingRules } from "../validators/index.js";

const router = Router();

router.get("/", getSettings);
router.put("/", protect, settingRules, validate, updateSettings);

export default router;
