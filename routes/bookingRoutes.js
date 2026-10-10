import { Router } from "express";
import {
  createBooking,
  getBookingById,
  getUserBookings,
} from "../controllers/bookingController.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.post("/", authenticate, createBooking);
router.get("/user/:userId", authenticate, getUserBookings);
router.get("/:id", authenticate, getBookingById);

export default router;
