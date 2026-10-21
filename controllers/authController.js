import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
  normalizePhoneNumber,
  verifyWidgetAccessToken,
} from "../utils/msg91Otp.js";
import {
  createPhoneRegistrationToken,
  verifyPhoneRegistrationToken,
} from "../utils/phoneRegistration.js";

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
  name: user.name ?? null,
  email: user.email ?? null,
  phone: user.phone ?? null,
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

export const verifyPhoneOtpAndAuthenticate = async (req, res) => {
  const secret = getJwtSecret();
  const accessToken = req.body?.accessToken;
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    const error = new Error("A valid MSG91 accessToken is required.");
    error.statusCode = 400;
    throw error;
  }

  const phone = await verifyWidgetAccessToken(accessToken, req.body?.phone);
  if (!phone) {
    return res.status(401).json({ message: "MSG91 widget token is invalid or expired." });
  }

  const user = await User.findOne({ phone }).select("+password");
  if (!user || !user.name || !user.email || !user.password) {
    return res.json({
      isNewUser: true,
      message: "Phone verified. Complete registration to continue.",
      phone,
      registrationToken: createPhoneRegistrationToken(phone, secret),
    });
  }

  res.json({
    isNewUser: false,
    message: "Phone authentication successful.",
    user: userResponse(user),
    token: createToken(user._id, secret),
  });
};

export const completePhoneRegistration = async (req, res) => {
  const secret = getJwtSecret();
  const registrationToken = req.body?.registrationToken;
  if (typeof registrationToken !== "string" || !registrationToken.trim()) {
    const error = new Error("A valid registrationToken is required.");
    error.statusCode = 400;
    throw error;
  }

  const phone = verifyPhoneRegistrationToken(registrationToken, secret);
  if (!phone) {
    return res.status(401).json({ message: "Registration token is invalid or expired." });
  }

  const name = req.body?.name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    const error = new Error("Enter a name of 1 to 100 characters.");
    error.statusCode = 400;
    throw error;
  }
  const email = validateCredentials(req.body?.email, req.body?.password);

  let user = await User.findOne({ phone }).select("+password");
  if (user?.name && user.email && user.password) {
    return res.status(409).json({ message: "This phone number is already registered." });
  }
  if (!user) {
    user = new User({ phone });
  }

  user.name = name.trim();
  user.email = email;
  user.password = req.body.password;
  await user.save();

  res.status(201).json({
    message: "Account created successfully.",
    user: userResponse(user),
    token: createToken(user._id, secret),
  });
};

// const logoutuser = async(req, res) => {
//   try{
//     const {email} = req.body;
//     const user = await User.findOne({email});

//     if(!user){
//       return res.status(404).json({
//         message: "User not found."
//       }); 
//     }

//     res.status(200).json({
//       message: "Logout successful."
//     });

//   }catch(error){
//     console.error("Logout failed:", error);
//     res.status(500).json({
//       message: "Logout failed. Please try again later."
//     });
//   }
// }
