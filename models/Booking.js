import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        paymentOrder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentOrder",
            unique: true,
            sparse: true,
        },
        car: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Car",
            required: true
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true,
            validate: {
                validator(value) {
                    return !this.startDate || value > this.startDate;
                },
                message: "End date must be after start date."
            }
        },
        totalPrice: {
            type: Number,
            required: true,
            min: [0, "Total price cannot be negative."],
            validate: {
                validator: Number.isFinite,
                message: "Total price must be a finite number."
            }
        }
    },
    { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;