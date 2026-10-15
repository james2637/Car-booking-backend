import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";
import Notification from "../models/Notification.js";
import PaymentOrder from "../models/PaymentOrder.js";
import User from "../models/User.js";
import { sendBookingConfirmation } from "../utils/firebaseMessaging.js";
import { calculateBookingPrice } from "../utils/bookingPricing.js";
import { getRazorpayClient } from "../utils/razorpay.js";

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const conflict = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};

const validateObjectId = (id, message) => {
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    throw badRequest(message);
  }
  return new mongoose.Types.ObjectId(id).toString();
};

const populateBookingDetails = (query) =>
  query.populate([
    { path: "user", select: "email" },
    { path: "car" },
  ]);

const validateBookingDetails = async ({ carId, startDate, endDate }) => {
  const validatedCarId = validateObjectId(carId, "A valid carId is required.");
  if (
    typeof startDate !== "string" ||
    !startDate.trim() ||
    typeof endDate !== "string" ||
    !endDate.trim()
  ) {
    throw badRequest("Valid startDate and endDate values are required.");
  }

  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);
  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    Number.isNaN(parsedEndDate.getTime())
  ) {
    throw badRequest("Valid startDate and endDate values are required.");
  }
  if (parsedEndDate <= parsedStartDate) {
    throw badRequest("endDate must be after startDate.");
  }

  const car = await Car.findById(validatedCarId);
  if (!car) {
    return null;
  }

  const pricing = calculateBookingPrice(car.price, parsedStartDate, parsedEndDate);
  const { amount, rentalDays, totalPrice } = pricing;
  if (!Number.isSafeInteger(amount) || amount < 100) {
    throw badRequest("The calculated booking amount must be at least INR 1.");
  }

  return {
    car,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    rentalDays,
    amount,
    totalPrice,
  };
};

const withCarBookingLock = async (carId, operation) => {
  const lockId = randomUUID();
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 120_000);
  const car = await Car.findOneAndUpdate(
    {
      _id: carId,
      $or: [
        { bookingLockUntil: { $exists: false } },
        { bookingLockUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        bookingLockId: lockId,
        bookingLockUntil: lockUntil,
      },
    },
    { returnDocument: "after" },
  ).select("+bookingLockId");

  if (!car) {
    throw conflict("This car is currently being booked. Please try again.");
  }

  try {
    return await operation(car);
  } finally {
    await Car.updateOne(
      { _id: carId, bookingLockId: lockId },
      { $unset: { bookingLockId: 1, bookingLockUntil: 1 } },
    );
  }
};

const assertCarAvailable = async ({
  carId,
  startDate,
  endDate,
  excludePaymentOrderId,
}) => {
  const overlap = {
    car: carId,
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  };
  const pendingFilter = {
    ...overlap,
    status: "pending",
    expiresAt: { $gt: new Date() },
  };
  if (excludePaymentOrderId) {
    pendingFilter._id = { $ne: excludePaymentOrderId };
    overlap.paymentOrder = { $ne: excludePaymentOrderId };
  }

  const [existingBooking, pendingOrder] = await Promise.all([
    Booking.exists(overlap),
    PaymentOrder.exists(pendingFilter),
  ]);
  if (existingBooking || pendingOrder) {
    throw conflict("This car is already booked or reserved for the selected dates.");
  }
};

export const createPaymentOrder = async (req, res) => {
  const details = await validateBookingDetails(req.body ?? {});
  if (!details) {
    return res.status(404).json({ message: "Car not found." });
  }

  const order = await withCarBookingLock(details.car._id, async (car) => {
    await assertCarAvailable({
      carId: car._id,
      startDate: details.startDate,
      endDate: details.endDate,
    });

    const pricing = calculateBookingPrice(
      car.price,
      details.startDate,
      details.endDate,
    );
    if (!Number.isSafeInteger(pricing.amount) || pricing.amount < 100) {
      throw badRequest("The calculated booking amount must be at least INR 1.");
    }

    const paymentOrderId = new mongoose.Types.ObjectId();
    const expiresAt = new Date(Date.now() + 30_000);
    const razorpayOrder = await getRazorpayClient().orders.create({
      amount: pricing.amount,
      currency: "INR",
      receipt: paymentOrderId.toString(),
      notes: {
        userId: req.userId,
        carId: car._id.toString(),
      },
    });

    await PaymentOrder.create({
      _id: paymentOrderId,
      user: req.userId,
      car: car._id,
      startDate: details.startDate,
      endDate: details.endDate,
      totalPrice: pricing.totalPrice,
      amount: pricing.amount,
      currency: "INR",
      razorpayOrderId: razorpayOrder.id,
      expiresAt,
    });

    return {
      id: razorpayOrder.id,
      amount: pricing.amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      rentalDays: pricing.rentalDays,
      totalPrice: pricing.totalPrice,
    };
  });

  res.status(201).json({ message: "Payment order created.", order });
};

const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET must be configured.");
  }
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
};

const sendBookingNotification = async ({ userId, booking, car }) => {
  const user = await User.findById(userId).select("+fcmToken");
  if (!user?.fcmToken) {
    return { sent: false, reason: "device_token_not_registered" };
  }

  try {
    await sendBookingConfirmation({ token: user.fcmToken, booking, car });
  } catch (error) {
    console.error("Booking notification failed:", error?.code, error?.message);
    return { sent: false, reason: "delivery_failed" };
  }

  try {
    await Notification.create({
      user: userId,
      title: "Booking successful",
      body: `Your booking for ${car.name} is confirmed.`,
      type: "booking_success",
      data: {
        bookingId: booking._id.toString(),
        carId: car._id.toString(),
        carName: car.name,
      },
    });
    return { sent: true, historySaved: true };
  } catch (error) {
    console.error("Failed to save booking notification history:", error);
    return { sent: true, historySaved: false };
  }
};

export const verifyPaymentAndCreateBooking = async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
    req.body ?? {};
  if (
    typeof orderId !== "string" ||
    !orderId ||
    typeof paymentId !== "string" ||
    !paymentId
  ) {
    throw badRequest("Razorpay order and payment IDs are required.");
  }
  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ message: "Invalid Razorpay payment signature." });
  }

  const paymentOrder = await PaymentOrder.findOne({
    razorpayOrderId: orderId,
    user: req.userId,
  });
  if (!paymentOrder) {
    return res.status(404).json({ message: "Payment order not found." });
  }

  if (paymentOrder.status === "paid") {
    if (paymentOrder.razorpayPaymentId !== paymentId) {
      return res.status(409).json({ message: "Payment order was already completed." });
    }
    const existingBooking = await populateBookingDetails(
      Booking.findOne({ paymentOrder: paymentOrder._id }),
    );
    if (existingBooking) {
      return res.json({
        message: "Payment already verified and booking created.",
        booking: existingBooking,
      });
    }
  }
  if (paymentOrder.status === "refunded") {
    return res.status(409).json({
      message: "This payment was refunded and cannot be used to create a booking.",
      refundId: paymentOrder.razorpayRefundId,
    });
  }

  const razorpay = getRazorpayClient();
  const payment = await razorpay.payments.fetch(paymentId);
  if (
    payment.order_id !== paymentOrder.razorpayOrderId ||
    payment.amount !== paymentOrder.amount ||
    payment.currency !== paymentOrder.currency
  ) {
    return res.status(400).json({ message: "Payment details do not match the order." });
  }
  if (!["authorized", "captured"].includes(payment.status)) {
    return res.status(409).json({
      message: "Payment has not been captured yet.",
      paymentStatus: payment.status,
    });
  }

  const result = await withCarBookingLock(paymentOrder.car, async (car) => {
    const currentPaymentOrder = await PaymentOrder.findById(paymentOrder._id);
    if (currentPaymentOrder?.status === "paid") {
      const existingBooking = await populateBookingDetails(
        Booking.findOne({ paymentOrder: currentPaymentOrder._id }),
      );
      if (existingBooking) {
        return { alreadyCompleted: true, booking: existingBooking };
      }
    }
    if (currentPaymentOrder?.status === "refunded") {
      return {
        alreadyRefunded: true,
        refundId: currentPaymentOrder.razorpayRefundId,
      };
    }

    try {
      await assertCarAvailable({
        carId: paymentOrder.car,
        startDate: paymentOrder.startDate,
        endDate: paymentOrder.endDate,
        excludePaymentOrderId: paymentOrder._id,
      });
    } catch (error) {
      if (error.statusCode !== 409) {
        throw error;
      }

      if (payment.status === "captured") {
        let refund;
        try {
          refund = await razorpay.payments.refund(paymentId, {
            amount: paymentOrder.amount,
          });
        } catch (refundError) {
          console.error(
            "Failed to refund payment for unavailable car:",
            refundError?.error?.code,
            refundError?.message,
          );
          const failure = new Error(
            "The car is no longer available and payment refund could not be initiated. Contact support.",
          );
          failure.statusCode = 502;
          throw failure;
        }

        paymentOrder.status = "refunded";
        paymentOrder.razorpayPaymentId = paymentId;
        paymentOrder.razorpayRefundId = refund.id;
        await paymentOrder.save();
        return {
          conflict: true,
          refunded: true,
          refundId: refund.id,
        };
      }

      return { conflict: true, refunded: false };
    }

    let capturedPayment = payment;
    if (payment.status === "authorized") {
      capturedPayment = await razorpay.payments.capture(
        paymentId,
        paymentOrder.amount,
        paymentOrder.currency,
      );
    }
    if (capturedPayment.status !== "captured") {
      return {
        paymentNotCaptured: true,
        paymentStatus: capturedPayment.status,
      };
    }

    let booking = await Booking.findOne({ paymentOrder: paymentOrder._id });
    if (!booking) {
      try {
        booking = await Booking.create({
          user: paymentOrder.user,
          car: paymentOrder.car,
          paymentOrder: paymentOrder._id,
          startDate: paymentOrder.startDate,
          endDate: paymentOrder.endDate,
          totalPrice: paymentOrder.totalPrice,
        });
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
        booking = await Booking.findOne({ paymentOrder: paymentOrder._id });
        if (!booking) {
          throw error;
        }
      }
    }

    paymentOrder.status = "paid";
    paymentOrder.razorpayPaymentId = paymentId;
    paymentOrder.booking = booking._id;
    await paymentOrder.save();
    await populateBookingDetails(booking);
    return { booking, car };
  });

  if (result.alreadyCompleted) {
    return res.json({
      message: "Payment already verified and booking created.",
      booking: result.booking,
    });
  }
  if (result.alreadyRefunded) {
    return res.status(409).json({
      message: "This payment was refunded and cannot be used to create a booking.",
      refundId: result.refundId,
    });
  }
  if (result.conflict) {
    return res.status(409).json({
      message: result.refunded
        ? "The car was booked by another customer. Your payment refund was initiated."
        : "The car was booked by another customer. Payment was not captured.",
      refunded: result.refunded,
      refundId: result.refundId,
    });
  }
  if (result.paymentNotCaptured) {
    return res.status(409).json({
      message: "Payment has not been captured yet.",
      paymentStatus: result.paymentStatus,
    });
  }

  const { booking, car } = result;
  const notification = await sendBookingNotification({
    userId: paymentOrder.user,
    booking,
    car,
  });
  res.status(201).json({
    message: "Payment verified and booking created successfully.",
    booking,
    notification,
  });
};

export const getUserPaymentHistory = async (req, res) => {
  const rawPage = req.query.page ?? "1";
  const rawLimit = req.query.limit ?? "20";
  const page = Number(rawPage);
  const limit = Number(rawLimit);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw badRequest("page must be a positive integer and limit must be between 1 and 100.");
  }

  const filter = { user: req.userId };
  const [paymentOrders, total] = await Promise.all([
    PaymentOrder.find(filter)
      .select(
        "totalPrice currency razorpayOrderId razorpayPaymentId startDate endDate car booking status createdAt updatedAt",
      )
      .populate({ path: "car", select: "name brand" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PaymentOrder.countDocuments(filter),
  ]);

  res.json({
    payments: paymentOrders.map((paymentOrder) => ({
      id: paymentOrder._id,
      totalPrice: paymentOrder.totalPrice,
      currency: paymentOrder.currency,
      status: paymentOrder.status,
      razorpayOrderId: paymentOrder.razorpayOrderId,
      razorpayPaymentId: paymentOrder.razorpayPaymentId,
      startDate: paymentOrder.startDate,
      endDate: paymentOrder.endDate,
      car: paymentOrder.car,
      bookingId: paymentOrder.booking,
      expiresAt: paymentOrder.expiresAt,
      updatedAt: paymentOrder.updatedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

export const getUserBookings = async (req, res) => {
  const userId = validateObjectId(req.params.userId, "A valid user ID is required.");
  if (userId !== req.userId) {
    return res.status(403).json({ message: "You can only view your own bookings." });
  }

  const bookings = await populateBookingDetails(
    Booking.find({ user: req.userId }).sort({ createdAt: -1 }),
  );

  res.json({ bookings });
};

export const getBookingById = async (req, res) => {
  const bookingId = validateObjectId(req.params.id, "A valid booking ID is required.");

  const booking = await populateBookingDetails(
    Booking.findOne({ _id: bookingId, user: req.userId }),
  );
  if (!booking) {
    return res.status(404).json({ message: "Booking not found." });
  }

  res.json({ booking });
};