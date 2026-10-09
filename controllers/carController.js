import mongoose from "mongoose";
import Car from "../models/Car.js";
import { deleteCarImages, uploadCarImages } from "../utils/cloudinaryImages.js";

const parseSpecifications = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    const error = new Error("specifications must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
};

const getCarData = (body) => ({
  name: body.name,
  brand: body.brand,
  transmission: body.transmission,
  fuelType: body.fuelType,
  seats: body.seats,
  rating: body.rating,
  mileageType: body.mileageType,
  specifications: parseSpecifications(body.specifications),
});

const validateCarId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid car ID.");
    error.statusCode = 400;
    throw error;
  }
};

const cleanupUploadedImages = async (images) => {
  try {
    await deleteCarImages(images);
  } catch (error) {
    console.error("Failed to clean up uploaded car images:", error);
  }
};

export const createCar = async (req, res) => {
  if (!req.files || req.files.length < 2) {
    return res.status(400).json({ message: "Upload between 2 and 4 car images." });
  }

  const car = new Car(getCarData(req.body));
  const uploadedImages = await uploadCarImages(req.files);

  try {
    car.images = uploadedImages;
    await car.save();
  } catch (error) {
    await cleanupUploadedImages(uploadedImages);
    throw error;
  }

  res.status(201).json({ message: "Car created successfully.", car });
};

export const getCars = async (req, res) => {
  const cars = await Car.find().sort({ createdAt: -1 });
  res.json({ cars });
};

export const getCarById = async (req, res) => {
  validateCarId(req.params.id);
  const car = await Car.findById(req.params.id);

  if (!car) {
    return res.status(404).json({ message: "Car not found." });
  }

  res.json({ car });
};

export const updateCar = async (req, res) => {
  validateCarId(req.params.id);
  const car = await Car.findById(req.params.id);

  if (!car) {
    return res.status(404).json({ message: "Car not found." });
  }

  const updates = getCarData(req.body);
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (key === "specifications" && value && typeof value === "object") {
        for (const [specification, specificationValue] of Object.entries(value)) {
          car.set(`specifications.${specification}`, specificationValue);
        }
      } else {
        car.set(key, value);
      }
    }
  }

  let uploadedImages = [];
  let previousImages = [];
  if (req.files?.length) {
    previousImages = car.images.map(({ url, publicId }) => ({ url, publicId }));
    uploadedImages = await uploadCarImages(req.files);
    car.images = uploadedImages;
  }

  try {
    await car.save();
  } catch (error) {
    await cleanupUploadedImages(uploadedImages);
    throw error;
  }

  let cleanupWarning;
  if (uploadedImages.length > 0) {
    try {
      await deleteCarImages(previousImages);
    } catch (error) {
      console.error("Failed to remove replaced car images from Cloudinary:", error);
      cleanupWarning = "The car was updated, but one or more replaced images could not be removed.";
    }
  }

  res.json({
    message: "Car updated successfully.",
    car,
    ...(cleanupWarning && { warning: cleanupWarning }),
  });
};

export const deleteCar = async (req, res) => {
  validateCarId(req.params.id);
  const car = await Car.findByIdAndDelete(req.params.id);

  if (!car) {
    return res.status(404).json({ message: "Car not found." });
  }

  let cleanupWarning;
  try {
    await deleteCarImages(car.images);
  } catch (error) {
    console.error("Failed to remove deleted car images from Cloudinary:", error);
    cleanupWarning = "The car was deleted, but one or more Cloudinary images could not be removed.";
  }

  res.json({
    message: "Car deleted successfully.",
    ...(cleanupWarning && { warning: cleanupWarning }),
  });
};
