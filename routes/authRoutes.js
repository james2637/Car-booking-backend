import { Router } from "express";
import {
  loginUser,
  registerUser,
  completePhoneRegistration,
  verifyPhoneOtpAndAuthenticate,
} from "../controllers/authController.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/otp/verify", verifyPhoneOtpAndAuthenticate);
router.post("/otp/register", completePhoneRegistration);

export default router;
