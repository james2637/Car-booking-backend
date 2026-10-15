import { Router } from "express";
import {
  createPaymentOrder,
  getBookingById,
  getUserPaymentHistory,
  getUserBookings,
  verifyPaymentAndCreateBooking,
} from "../controllers/bookingController.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.post("/payment/order", authenticate, createPaymentOrder);
router.post("/payment/verify", authenticate, verifyPaymentAndCreateBooking);
router.get("/payment/history", authenticate, getUserPaymentHistory);
router.post("/", authenticate, (req, res) =>
  res.status(400).json({
    message: "Bookings require payment. Create an order at POST /api/bookings/payment/order.",
  }),
);
router.get("/user/:userId", authenticate, getUserBookings);
router.get("/:id", authenticate, getBookingById);

export default router;
