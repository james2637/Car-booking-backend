import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters."],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters."],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address."],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters."],
      maxlength: [72, "Password cannot exceed 72 characters."],
      select: false,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      match: [/^\d{8,15}$/, "Enter a valid phone number."],
    },
    fcmToken: {
      type: String,
      select: false,
    },
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Car",
      },
    ],
  },
  { timestamps: true },
);

userSchema.pre("validate", function validateLoginMethod() {
  if ((!this.email || !this.password) && !this.phone) {
    this.invalidate("phone", "A phone number or an email and password are required.");
  }
});

userSchema.pre("save", async function hashPassword() {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

const User = mongoose.model("User", userSchema);

export default User;
