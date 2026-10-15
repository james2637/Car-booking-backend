import { Router } from "express";
import {
  getNotificationHistory,
  registerDeviceToken,
  sendPromotionalNotification,
  unregisterDeviceToken,
} from "../controllers/notificationController.js";
import authenticate from "../middleware/authenticate.js";
import requirePromotionalApiKey from "../middleware/requirePromotionalApiKey.js";

const router = Router();

router.get("/", authenticate, getNotificationHistory);
router.post(
  "/promotional",
  requirePromotionalApiKey,
  sendPromotionalNotification,
);
router.put("/device-token", authenticate, registerDeviceToken);
router.delete("/device-token", authenticate, unregisterDeviceToken);

export default router;
