import { Router } from "express";
import {
  createMessage,
  getMessages,
  updateMessage,
  bulkUpdateMessages,
  deleteMessage,
} from "../controllers/messageController.js";
import { protect } from "../middlewares/auth.js";
import { messageLimiter } from "../middlewares/rateLimit.js";
import validate from "../middlewares/validate.js";
import {
  idParam,
  createMessageRules,
  listMessageRules,
  updateMessageRules,
  bulkMessageRules,
} from "../validators/index.js";

const router = Router();

router
  .route("/")
  .post(messageLimiter, createMessageRules, validate, createMessage)
  .get(protect, listMessageRules, validate, getMessages);

router.patch("/bulk", protect, bulkMessageRules, validate, bulkUpdateMessages);

router
  .route("/:id")
  .patch(protect, updateMessageRules, validate, updateMessage)
  .delete(protect, idParam, validate, deleteMessage);

export default router;
