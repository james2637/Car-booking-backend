import mongoose from "mongoose";

const carImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const carSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Car name is required."],
      trim: true,
      maxlength: [100, "Car name cannot exceed 100 characters."],
    },
    brand: {
      type: String,
      required: [true, "Car brand is required."],
      trim: true,
      maxlength: [80, "Car brand cannot exceed 80 characters."],
    },
    transmission: {
      type: String,
      required: [true, "Transmission is required."],
      enum: ["Manual", "Automatic"],
    },
    fuelType: {
      type: String,
      required: [true, "Fuel type is required."],
      enum: ["Petrol", "Diesel"],
    },
    seats: {
      type: Number,
      required: [true, "Seat count is required."],
      min: [1, "A car must have at least one seat."],
      max: [100, "Seat count cannot exceed 100."],
      validate: {
        validator: Number.isInteger,
        message: "Seat count must be a whole number.",
      },
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be below 0."],
      max: [5, "Rating cannot exceed 5."],
    },
    mileageType: {
      type: String,
      required: [true, "Mileage type is required."],
      enum: ["Fixed", "Unlimited"],
    },
    specifications: {
      engine: {
        type: String,
        required: [true, "Engine specification is required."],
        trim: true,
        maxlength: [80, "Engine specification cannot exceed 80 characters."],
      },
      mileage: {
        type: String,
        required: [true, "Mileage specification is required."],
        trim: true,
        maxlength: [80, "Mileage specification cannot exceed 80 characters."],
      },
      ac: {
        type: Boolean,
        required: [true, "AC specification is required."],
      },
      carType: {
        type: String,
        required: [true, "Car type is required."],
        trim: true,
        maxlength: [50, "Car type cannot exceed 50 characters."],
      },
    },
    images: {
      type: [carImageSchema],
      required: [true, "At least two car images are required."],
      validate: [
        {
          validator: (images) => images.length >= 2 && images.length <= 4,
          message: "A car must have between 2 and 4 images.",
        },
      ],
    },
  },
  { timestamps: true },
);

const Car = mongoose.model("Car", carSchema);

export default Car;
