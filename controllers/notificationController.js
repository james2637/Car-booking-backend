import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendPromotionalNotification as sendPromotionalMessage } from "../utils/firebaseMessaging.js";

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const getNotificationHistory = async (req, res) => {
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
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  res.json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
};

export const sendPromotionalNotification = async (req, res) => {
  const { userId, title, body } = req.body ?? {};
  if (typeof userId !== "string" || !mongoose.Types.ObjectId.isValid(userId)) {
    throw badRequest("A valid userId is required.");
  }
  if (typeof title !== "string" || !title.trim() || title.trim().length > 100) {
    throw badRequest("title is required and must be 100 characters or fewer.");
  }
  if (typeof body !== "string" || !body.trim() || body.trim().length > 500) {
    throw badRequest("body is required and must be 500 characters or fewer.");
  }

  const user = await User.findById(userId).select("+fcmToken");
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  if (!user.fcmToken) {
    return res.status(409).json({
      message: "The user does not have a registered device token.",
    });
  }

  const notification = {
    title: title.trim(),
    body: body.trim(),
    type: "promotional",
    data: { type: "promotional" },
  };

  try {
    await sendPromotionalMessage({
      token: user.fcmToken,
      title: notification.title,
      body: notification.body,
    });
  } catch (error) {
    console.error("Promotional notification failed:", error?.code, error?.message);
    return res.status(502).json({
      message: "Firebase could not accept the promotional notification.",
      reason: error?.code || "delivery_failed",
    });
  }

  let historySaved = true;
  try {
    await Notification.create({
      user: user._id,
      ...notification,
    });
  } catch (error) {
    historySaved = false;
    console.error("Failed to save promotional notification history:", error);
  }

  res.json({
    message: "Promotional notification accepted by Firebase.",
    notification: { sent: true, historySaved },
  });
};

export const registerDeviceToken = async (req, res) => {
  const token = req.body?.fcmToken;
  if (typeof token !== "string" || !token.trim() || token.length > 4096) {
    throw badRequest("A valid fcmToken is required.");
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    { fcmToken: token.trim() },
    { returnDocument: "after" },
  );
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ message: "FCM device token registered." });
};

export const unregisterDeviceToken = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.userId,
    { $unset: { fcmToken: 1 } },
    { returnDocument: "after" },
  );
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ message: "FCM device token removed." });
};
