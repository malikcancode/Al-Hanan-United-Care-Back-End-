import { Router } from "express";
import { login, getMe, changePassword } from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import { loginLimiter } from "../middlewares/rateLimit.js";
import { loginRules, changePasswordRules } from "../validators/index.js";

const router = Router();

router.post("/login", loginLimiter, loginRules, validate, login);
router.get("/me", protect, getMe);
router.put("/password", protect, changePasswordRules, validate, changePassword);

export default router;
