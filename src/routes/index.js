import { Router } from "express";
import authRoutes from "./authRoutes.js";
import appointmentRoutes from "./appointmentRoutes.js";
import serviceRoutes from "./serviceRoutes.js";
import doctorRoutes from "./doctorRoutes.js";
import settingRoutes from "./settingRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import messageRoutes from "./messageRoutes.js";
import activityRoutes from "./activityRoutes.js";
import revalidateOn from "../middlewares/revalidate.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/appointments", appointmentRoutes);
// Changes to these refresh the website's cached copy immediately
router.use("/services", revalidateOn("services"), serviceRoutes);
router.use("/doctors", revalidateOn("doctors"), doctorRoutes);
router.use("/settings", revalidateOn("settings"), settingRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/messages", messageRoutes);
router.use("/activity", activityRoutes);

export default router;
