import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured.");
    error.statusCode = 500;
    throw error;
  }

  return process.env.JWT_SECRET;
};

const validateCredentials = (email, password) => {
  if (typeof email !== "string" || typeof password !== "string") {
    const error = new Error("Email and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    const error = new Error("Enter a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Password cannot exceed 72 bytes.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedEmail;
};

const createToken = (userId, secret) =>
  jwt.sign({ sub: userId.toString() }, secret, { expiresIn: "7d" });

const userResponse = (user) => ({
  id: user._id,
  email: user.email,
  createdAt: user.createdAt,
});

export const registerUser = async (req, res) => {
  const secret = getJwtSecret();
  const email = validateCredentials(req.body?.email, req.body?.password);

  const user = await User.create({
    email,
    password: req.body.password,
  });

  res.status(201).json({
    message: "Account created successfully.",
    user: userResponse(user),
    token: createToken(user._id, secret),
  });
};

export const loginUser = async (req, res) => {
  const secret = getJwtSecret();
  const email = validateCredentials(req.body?.email, req.body?.password);
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  res.json({
    message: "Login successful.",
    user: userResponse(user),
    token: createToken(user._id, secret),
  });
};
