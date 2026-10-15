import { Router } from "express";
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from "../controllers/notificationController.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.put("/device-token", authenticate, registerDeviceToken);
router.delete("/device-token", authenticate, unregisterDeviceToken);

export default router;
