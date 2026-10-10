import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Car from "../models/Car.js";

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
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

export const createBooking = async (req, res) => {
  const { carId, startDate, endDate, totalPrice } = req.body ?? {};

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

  if (typeof totalPrice !== "number" || !Number.isFinite(totalPrice) || totalPrice < 0) {
    throw badRequest("totalPrice must be a non-negative number.");
  }

  const car = await Car.findById(validatedCarId);
  if (!car) {
    return res.status(404).json({ message: "Car not found." });
  }

  const booking = await Booking.create({
    user: req.userId,
    car: car._id,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    totalPrice,
  });

  await populateBookingDetails(booking);

  res.status(201).json({
    message: "Booking created successfully.",
    booking,
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